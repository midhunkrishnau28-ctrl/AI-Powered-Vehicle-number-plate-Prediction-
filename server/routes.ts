import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { setupAuth } from "./auth";
import passport from "passport";
import express from "express";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import { predictNumberPlate } from "./anpr-service";
import { sendOtpEmail } from "./email";

// Initialize Google AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY as string,
});

// Retry wrapper for Gemini API calls — handles 503 UNAVAILABLE with exponential backoff
async function geminiGenerateWithRetry(
  params: Parameters<typeof ai.models.generateContent>[0],
  maxRetries = 4
): Promise<Awaited<ReturnType<typeof ai.models.generateContent>>> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
      const msg: string = err?.message || String(err);
      const isOverloaded =
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("overloaded") ||
        msg.includes("high demand") ||
        (err?.status === 503);

      if (!isOverloaded || attempt === maxRetries) throw err;

      const waitMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s, 16s
      console.warn(
        `[Gemini] 503 overloaded — retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${maxRetries})...`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

// --- Plate Candidate Generator ---
// Separate tables for letters and digits — ensures alternatives are always valid format
const LETTER_CONFUSIONS: Record<string, string[]> = {
  // Visually similar LETTERS only (never mixed with digits)
  "O": ["D", "Q"],  "D": ["O", "B"],  "Q": ["O", "G"],
  "I": ["L", "T"],  "L": ["I", "T"],  "T": ["I", "L", "J"],  "J": ["I", "T"],
  "B": ["P", "R"],  "P": ["R", "F"],  "R": ["P", "K", "B"],  "F": ["E", "P"],
  "E": ["F"],       "S": ["G", "Z"],  "Z": ["S"],
  "G": ["C", "S"],  "C": ["G", "O"],
  "U": ["V"],       "V": ["U", "Y"],  "Y": ["V"],
  "H": ["N", "M"],  "M": ["N", "H"],  "N": ["H", "M"],
  "K": ["X", "R"],  "X": ["K"],       "A": ["H"],
};

const DIGIT_CONFUSIONS: Record<string, string[]> = {
  // Visually similar DIGITS only (never mixed with letters)
  "0": ["8", "6"],  "8": ["0", "3"],  "6": ["0", "8", "5"],
  "1": ["7"],       "7": ["1"],
  "2": ["7", "3"],  "3": ["8", "2"],
  "4": ["9", "1"],  "9": ["4", "8"],
  "5": ["6"],
};

function isDigit(ch: string): boolean { return ch >= "0" && ch <= "9"; }

function generatePlateCandidates(
  primaryPlate: string,
  existingCandidates: { plate: string; score: number }[] = [],
  maxAlternatives = 5
): { plate: string; score: number; reason?: string }[] {
  if (!primaryPlate || primaryPlate === "Unknown") return existingCandidates;
  // Don't generate alternatives for partial/fragment plates (< 6 alphanum chars)
  if (primaryPlate.replace(/\s/g, "").length < 6) return [];

  // Work on the plate as-is (preserve spaces for display formatting)
  const upper = primaryPlate.toUpperCase();
  // For dedup comparisons, strip spaces
  const norm = upper.replace(/\s/g, "");
  const seen = new Set<string>([norm]);
  existingCandidates.forEach(c => seen.add(c.plate.toUpperCase().replace(/\s/g, "")));

  const result: { plate: string; score: number; reason: string }[] = [];

  // Iterate over each character position in the original spaced string
  for (let i = 0; i < upper.length && result.length < maxAlternatives; i++) {
    const ch = upper[i];
    if (ch === " ") continue; // preserve spaces

    // Choose the correct confusion table based on character type
    const confTable = isDigit(ch) ? DIGIT_CONFUSIONS : LETTER_CONFUSIONS;
    const alts = confTable[ch];
    if (!alts) continue;

    for (const alt of alts) {
      if (result.length >= maxAlternatives) break;
      // Build the variant preserving original spacing
      const variant = upper.slice(0, i) + alt + upper.slice(i + 1);
      const variantNorm = variant.replace(/\s/g, "");
      if (!seen.has(variantNorm)) {
        seen.add(variantNorm);
        const score = parseFloat((Math.max(0.30, 0.88 - result.length * 0.06)).toFixed(2));
        result.push({
          plate: variant,
          score,
          reason: `'${ch}' misread as '${alt}' (visual similarity)`,
        });
      }
    }
  }

  // Merge: real ML/Gemini candidates first, then generated ones
  const merged = [
    ...existingCandidates,
    ...result.filter(r => !existingCandidates.some(e =>
      e.plate.toUpperCase().replace(/\s/g, "") === r.plate.replace(/\s/g, "")
    )),
  ].slice(0, maxAlternatives);

  return merged;
}

// Normalize plate string: remove hyphens/dots, collapse spaces, uppercase
function normalizePlate(plate: string): string {
  if (!plate || plate === "Unknown") return plate;
  const cleaned = plate
    .toUpperCase()
    .replace(/[-_.]/g, " ")      // replace hyphens, dots, underscores with space
    .replace(/\s+/g, " ")        // collapse multiple spaces
    .trim();
  return correctIndianPlateFormat(cleaned);
}

// Maps digit→likely letter (for series position where letters are expected)
const DIGIT_TO_LETTER: Record<string, string> = {
  "0": "O", "1": "I", "2": "Z", "3": "B",
  "4": "A", "5": "S", "6": "G", "7": "T", "8": "B", "9": "P",
};
// Maps letter→likely digit (for district/number positions where digits are expected)
const LETTER_TO_DIGIT: Record<string, string> = {
  "O": "0", "I": "1", "L": "1", "Z": "2", "S": "5",
  "G": "6", "T": "7", "B": "8", "A": "4",
};

/**
 * Indian plate structure (no spaces): SS DD LL NNNN
 *   pos 0-1  : 2 letters  (state code, e.g. KL, TN, MH)
 *   pos 2-3  : 2 digits   (district code, e.g. 10, 07)
 *   pos 4-5  : 1-3 letters (series, e.g. AA, BX, ZA)
 *   last 4   : 4 digits   (registration number)
 *
 * If OCR puts digits in the letter-series slot (e.g. "24" instead of "ZA"),
 * this function converts them to their most likely letter equivalents.
 */
function correctIndianPlateFormat(plate: string): string {
  // Strip spaces for analysis, remember original spacing
  const stripped = plate.replace(/\s/g, "");

  // Must be 8-10 chars to be a valid Indian plate
  if (stripped.length < 8 || stripped.length > 10) return plate;

  const state  = stripped.slice(0, 2);   // always letters
  const dist   = stripped.slice(2, 4);   // always digits
  const regNum = stripped.slice(-4);     // always digits (last 4)
  const series = stripped.slice(4, stripped.length - 4); // letters in between

  let corrected = false;

  // Fix state: if digits found where letters expected
  const fixedState  = state.split("").map(ch =>
    isDigit(ch) ? (DIGIT_TO_LETTER[ch] ?? ch) : ch
  ).join("");
  if (fixedState !== state) corrected = true;

  // Fix district: if letters found where digits expected
  const fixedDist = dist.split("").map(ch =>
    !isDigit(ch) ? (LETTER_TO_DIGIT[ch] ?? ch) : ch
  ).join("");
  if (fixedDist !== dist) corrected = true;

  // Fix series: if digits found where letters expected
  const fixedSeries = series.split("").map(ch =>
    isDigit(ch) ? (DIGIT_TO_LETTER[ch] ?? ch) : ch
  ).join("");
  if (fixedSeries !== series) corrected = true;

  // Fix registration number: if letters found where digits expected
  const fixedReg = regNum.split("").map(ch =>
    !isDigit(ch) ? (LETTER_TO_DIGIT[ch] ?? ch) : ch
  ).join("");
  if (fixedReg !== regNum) corrected = true;

  if (!corrected) return plate; // nothing changed, preserve original spacing

  // Reassemble with spaces: "ST DI SR RRRR"
  const result = `${fixedState} ${fixedDist} ${fixedSeries} ${fixedReg}`;
  console.log(`[Plate Corrector] ${plate} → ${result}`);
  return result;
}

// --- Robust JSON Extraction Helpers ---
function unescapeJsonString(str: string): string {
  if (!str) return str;
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function extractJsonField(text: string, fieldName: string): string | null {
  // Find the field start
  const fieldPattern = `"${fieldName}"`;
  const fieldIndex = text.indexOf(fieldPattern);
  if (fieldIndex === -1) return null;

  // Find the opening quote after the colon
  const afterField = text.substring(fieldIndex + fieldPattern.length);
  const colonIndex = afterField.indexOf(':');
  if (colonIndex === -1) return null;

  const afterColon = afterField.substring(colonIndex + 1).trim();
  if (!afterColon.startsWith('"')) return null;

  // Extract content until we find an unescaped closing quote
  let content = '';
  let i = 1; // Start after the opening quote
  while (i < afterColon.length) {
    const char = afterColon[i];
    if (char === '\\' && i + 1 < afterColon.length) {
      // Escaped character - include both the backslash and next char
      content += afterColon.substring(i, i + 2);
      i += 2;
    } else if (char === '"') {
      // Found the closing quote
      return unescapeJsonString(content);
    } else {
      content += char;
      i++;
    }
  }

  return null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Increase payload limit for base64 images
  // Increase payload limit for large video files
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Health check endpoint for Render.com deployment monitoring
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Setup Auth
  setupAuth(app);

  // Authentication Routes
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, email, firstName, lastName } = req.body;
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser({
        username,
        password, // In a real app, use hashed passwords!
        email,
        firstName,
        lastName,
      });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        res.status(201).json(user);
      });
    } catch (error) {
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // ── Password Reset via OTP ─────────────────────────────────────────────────

  // Step 1: Officer submits their email → generate OTP → send email
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await storage.getUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({
        message: "This email is not registered in our system. Please use the email you signed up with.",
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await storage.saveOtp(user.email!, otp, expiresAt);

    try {
      await sendOtpEmail(user.email!, otp);
    } catch (err) {
      console.error("[Email] Failed to send OTP:", err);
      return res.status(500).json({ message: "Failed to send OTP email. Check server EMAIL configuration." });
    }

    res.json({ message: "OTP sent to your registered email address." });
  });

  // Step 2: Verify OTP (without resetting yet — lets UI show password step)
  app.post("/api/auth/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

    const valid = await storage.verifyOtp(email.trim().toLowerCase(), otp.trim());
    if (!valid) {
      return res.status(400).json({ message: "Invalid or expired OTP. Please try again." });
    }
    res.json({ valid: true });
  });

  // Step 3: Reset password (verify OTP once more then update)
  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const valid = await storage.verifyOtp(email.trim().toLowerCase(), otp.trim());
    if (!valid) {
      return res.status(400).json({ message: "Invalid or expired OTP. Please request a new one." });
    }

    await storage.markOtpUsed(email.trim().toLowerCase(), otp.trim());
    await storage.resetPassword(email.trim().toLowerCase(), newPassword);

    res.json({ message: "Password reset successfully. You can now log in." });
  });

  // ─────────────────────────────────────────────────────────────────────────

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    return res.status(401).json({ message: "Not authenticated" });
  });

  // Placeholder routes removed to use API routes correctly

  // Reports API
  app.post(api.reports.create.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const input = api.reports.create.input.parse(req.body);
      const userId = (req.user as any).id;

      // 1. Save Image to local storage
      const fileName = `${crypto.randomBytes(16).toString("hex")}-${input.filename}`;
      const uploadDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadDir, { recursive: true }); // Ensure the upload directory exists
      const filePath = path.join(uploadDir, fileName);

      const base64Data = input.image.replace(/^data:image\/\w+;base64,/, "");
      await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));
      const imageUrl = `/uploads/${fileName}`;

      // 2. Create initial report record
      const report = await storage.createReport({
        userId,
        imageUrl,
        originalFilename: input.filename,
      });

      // 3. Process with Local ML Model first, then Gemini (Async)
      // We don't await this so the UI gets a response quickly.
      // In a production app, use a job queue.
      (async () => {
        try {
          // --- First: Try Local ML Service ---
          console.log("[Analysis] Querying local ML service for number plate...");
          const localPrediction = await predictNumberPlate(input.image);
          let predictedNumberPlate = "Unknown";
          let candidates: { plate: string, score: number }[] = [];

          if (localPrediction) {
            predictedNumberPlate = localPrediction.plate;
            candidates = localPrediction.candidates || [];
            console.log(`[Analysis] Local ML predicted plate: ${predictedNumberPlate}`);
          }

          // --- Second: Run Gemini for Forensic Description ---
          // Extract MIME type and raw data for Image
          const base64Parts = input.image.split(",");
          let mimeType = "image/jpeg";
          let base64Data = input.image;

          if (base64Parts.length > 1) {
            const mimeMatch = base64Parts[0].match(/:(.*?);/);
            if (mimeMatch) mimeType = mimeMatch[1];
            base64Data = base64Parts[1];
          }

          const currentTimeIST = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'full',
            timeStyle: 'long'
          });

          const prompt = `
            FORENSIC IMAGE ANALYSIS - DETAILED INCIDENT RECONSTRUCTION
            CURRENT ANALYSIS TIME (IST): ${currentTimeIST}
            
            You are a senior forensic analyst examining this image for a police investigation. Your task is to 
            provide an EXTREMELY DETAILED, professional forensic analysis that reconstructs the incident and 
            describes EVERYTHING visible in the image.
            
            Write a comprehensive narrative report in 5-8 detailed paragraphs. Be thorough and observant.
            
            CRITICAL INSTRUCTIONS:
            1. Examine EVERY detail in the image carefully
            2. Read and transcribe ALL visible text (license plates, signs, advertisements, shop names, vehicle text)
            3. Describe the incident/scene as if you're reconstructing what happened
            4. Use professional forensic language but be descriptive and detailed
            5. Include measurements, positions, directions, and spatial relationships
            6. Note any evidence of movement, damage, or unusual conditions
            7. Mention the analysis time (${currentTimeIST}) if relevant to the findings.
            
            YOUR ANALYSIS MUST COVER:
            
            PARAGRAPH 1 - INCIDENT OVERVIEW & CONTEXT:
            - What type of incident/scene is this? (traffic violation, accident, surveillance, etc.)
            - Overall scene description and initial observations
            - Time indicators (lighting suggests morning/afternoon/evening/night)
            - Weather and environmental conditions
            - State that this analysis was performed at ${currentTimeIST}
            
            PARAGRAPH 2 - PRIMARY VEHICLE DETAILED DESCRIPTION:
            - Exact color, make, model, body type (sedan/SUV/truck/etc.)
            - License plate number (CRITICAL: Read carefully, use Indian patterns like KL-XX-XX-XXXX)
            - Distinctive features: dents, scratches, modifications, stickers, accessories
            - Vehicle condition and age indicators
            - Position and orientation of the vehicle
            - Any visible damage or unusual conditions
            
            PARAGRAPH 3 - TEXT & SIGNAGE EXTRACTION:
            - ALL readable text on signs, boards, advertisements
            - Shop names, business names, street names
            - Any text on vehicles (company names, slogans)
            - Road signs and traffic information
            - Building numbers or identifiers
            - Any other written information visible
            
            PARAGRAPH 4 - LOCATION & ENVIRONMENT:
            - Type of location (urban/suburban/rural, commercial/residential)
            - Road type and condition (highway/street/lane, paved/unpaved)
            - Visible landmarks (buildings, structures, monuments)
            - Background details (trees, poles, barriers, fences)
            - Infrastructure elements (streetlights, traffic signals, CCTV cameras)
            
            PARAGRAPH 5 - ADDITIONAL VEHICLES & PEOPLE:
            - Other vehicles: count, types, colors, positions, directions
            - People: count, positions, activities, clothing descriptions
            - Interactions between people/vehicles
            - Movement indicators or trajectories
            
            PARAGRAPH 6 - TRAFFIC & SAFETY ELEMENTS:
            - Traffic signals, signs, road markings
            - Lane markings, zebra crossings, speed bumps
            - Safety barriers, guardrails, dividers
            - Parking indicators, no-parking zones
            
            PARAGRAPH 7 - TECHNICAL ASSESSMENT:
            - Image quality: resolution, clarity, focus
            - Lighting conditions and visibility
            - Any blur, obstruction, or quality issues
            - Camera angle and perspective
            - Timestamp or metadata if visible
            
            PARAGRAPH 8 - FORENSIC CONCLUSIONS:
            - Key evidence identified
            - Confidence level in license plate reading
            - Any anomalies or points of interest
            - Recommendations for investigation
            
            Return ONLY valid JSON with this structure:
            {
              "numberPlate": "most likely plate number or Unknown",
              "alternativePlates": [
                { "plate": "second most likely reading", "confidence": 0.85, "reason": "brief reason e.g. digit 0 vs O ambiguity" },
                { "plate": "third possible reading", "confidence": 0.72, "reason": "brief reason" }
              ],
              "detailedAnalysis": "Your comprehensive 5-8 paragraph forensic narrative covering all aspects above. Use \\n\\n to separate paragraphs. Be extremely detailed and thorough."
            }

            RULES FOR alternativePlates:
            - Always include 3-5 alternatives even if you are highly confident (show the runner-up interpretations)
            - Consider common OCR/visual ambiguities: 0/O, 1/I/L, 8/B, 5/S, 2/Z, 6/G, 7/T
            - confidence must be a number between 0.0 and 1.0
            - If the plate is completely unreadable return an empty array []
            
            CRITICAL REMINDERS:
            - Write in complete, flowing sentences (NOT bullet points)
            - Be EXTREMELY detailed - this is a forensic investigation
            - Read ALL visible text and include it in your analysis
            - Describe spatial relationships and positions precisely
            - Use professional forensic terminology
            - Each paragraph should be substantial (4-6 sentences minimum)
          `;

          const response = await geminiGenerateWithRetry({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
              temperature: 0.0,
              candidateCount: 1,
              maxOutputTokens: 4000,
            },
          });

          const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text;
          console.log(`[Gemini Image Analysis Raw Response]: ${resultText}`);

          let analysisResult = "Could not analyze image.";

          if (resultText) {
            try {
              // --- ULTIMATE JSON ROBUSTNESS ---
              // 1. Strip potential markdown markers
              let cleanJson = resultText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

              // 2. Strict capture of FIRST { to LAST }
              const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
              if (jsonMatch) cleanJson = jsonMatch[0];

              // Stricter cleaning: remove true control chars but not newlines/tabs
              const forParsing = cleanJson.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

              console.log(`[Gemini Image Analysis] Cleaned JSON for parsing: ${forParsing}`);
              const json = JSON.parse(forParsing);

              // Override only if local ML didn't find one
              if (predictedNumberPlate === "Unknown" && json.numberPlate && json.numberPlate !== "Unknown") {
                predictedNumberPlate = normalizePlate(json.numberPlate);
                console.log(`[Analysis] Used Gemini's plate prediction: ${predictedNumberPlate}`);
              }

              // Merge Gemini alternative plates into candidates (fill in when local ML is offline)
              if (json.alternativePlates && Array.isArray(json.alternativePlates)) {
                const geminiCandidates = (json.alternativePlates as any[])
                  .filter((a: any) => a.plate && a.plate !== "Unknown" && a.plate !== predictedNumberPlate)
                  .map((a: any) => ({ plate: String(a.plate), score: Number(a.confidence) || 0.5 }));
                if (geminiCandidates.length > 0) {
                  // Prepend the primary plate as the top candidate if not already in list
                  const primaryCandidate = { plate: predictedNumberPlate, score: 1.0 };
                  const existingPlates = candidates.map(c => c.plate);
                  const mergedCandidates = [
                    ...(existingPlates.includes(predictedNumberPlate) ? [] : [primaryCandidate]),
                    ...candidates,
                    ...geminiCandidates.filter(g => !existingPlates.includes(g.plate)),
                  ];
                  candidates = mergedCandidates;
                  console.log(`[Analysis] Merged ${geminiCandidates.length} Gemini alternative(s) into candidates`);
                }
              }

              // Build formatted analysis from structured data
              let formattedAnalysis = "";

              // Vehicle Details
              if (json.vehicleDetails) {
                formattedAnalysis += "### Primary Vehicle Details\n";
                formattedAnalysis += `• Color: ${json.vehicleDetails.color || 'Unknown'}\n`;
                formattedAnalysis += `• Type: ${json.vehicleDetails.type || 'Unknown'}\n`;
                formattedAnalysis += `• Make: ${json.vehicleDetails.make || 'Unknown'}\n`;
                formattedAnalysis += `• Model: ${json.vehicleDetails.model || 'Unknown'}\n\n`;
              }

              // Scene Context
              if (json.sceneContext) {
                formattedAnalysis += "### Scene Context\n";
                formattedAnalysis += `• Time of Day: ${json.sceneContext.timeOfDay || 'Unknown'}\n`;
                formattedAnalysis += `• Weather: ${json.sceneContext.weather || 'Unknown'}\n`;
                formattedAnalysis += `• Lighting: ${json.sceneContext.lighting || 'Unknown'}\n\n`;
              }

              // Objects Detected
              if (json.objects && json.objects.length > 0) {
                formattedAnalysis += "### Objects Detected\n";
                json.objects.forEach((obj: string) => {
                  formattedAnalysis += `• ${obj}\n`;
                });
                formattedAnalysis += "\n";
              }

              // Additional Text
              if (json.additionalText && json.additionalText.length > 0) {
                formattedAnalysis += "### Additional Text Detected\n";
                json.additionalText.forEach((text: string) => {
                  formattedAnalysis += `• ${text}\n`;
                });
                formattedAnalysis += "\n";
              }

              // Other Vehicles
              if (json.otherVehicles && json.otherVehicles.length > 0) {
                formattedAnalysis += "### Other Vehicles\n";
                json.otherVehicles.forEach((vehicle: any) => {
                  formattedAnalysis += `• ${vehicle.type || 'Vehicle'} (${vehicle.color || 'Unknown color'}) - ${vehicle.position || 'Position unknown'}\n`;
                });
                formattedAnalysis += "\n";
              }

              // People
              if (json.people) {
                formattedAnalysis += "### People Detected\n";
                formattedAnalysis += `• Count: ${json.people.count || 0}\n`;
                if (json.people.descriptions && json.people.descriptions.length > 0) {
                  json.people.descriptions.forEach((desc: string) => {
                    formattedAnalysis += `• ${desc}\n`;
                  });
                }
                formattedAnalysis += "\n";
              }

              // Landmarks
              if (json.landmarks && json.landmarks.length > 0) {
                formattedAnalysis += "### Landmarks\n";
                json.landmarks.forEach((landmark: string) => {
                  formattedAnalysis += `• ${landmark}\n`;
                });
                formattedAnalysis += "\n";
              }

              // Traffic Elements
              if (json.trafficElements && json.trafficElements.length > 0) {
                formattedAnalysis += "### Traffic Elements\n";
                json.trafficElements.forEach((element: string) => {
                  formattedAnalysis += `• ${element}\n`;
                });
                formattedAnalysis += "\n";
              }

              // Environment
              if (json.environment) {
                formattedAnalysis += "### Environment\n";
                formattedAnalysis += `${json.environment}\n\n`;
              }

              // Quality Assessment
              if (json.qualityAssessment) {
                formattedAnalysis += "### Image Quality Assessment\n";
                formattedAnalysis += `• Clarity: ${json.qualityAssessment.clarity || 'Unknown'}\n`;
                formattedAnalysis += `• Blur Level: ${json.qualityAssessment.blur || 'Unknown'}\n`;
                formattedAnalysis += `• Visibility: ${json.qualityAssessment.visibility || 'Unknown'}\n`;
              }

              analysisResult = json.detailedAnalysis || "Analysis completed but no detailed narrative was generated.";

            } catch (e) {
              console.warn("[Gemini Image Analysis] JSON.parse failed, falling back to regex extraction.");

              const extractedPlate = extractJsonField(resultText, "numberPlate");
              const extractedDetails = extractJsonField(resultText, "detailedAnalysis");

              if (extractedPlate && predictedNumberPlate === "Unknown" && extractedPlate !== "Unknown") {
                predictedNumberPlate = normalizePlate(extractedPlate);
                console.log(`[Analysis] Used Gemini's raw plate prediction: ${predictedNumberPlate}`);
              }
              if (extractedDetails) {
                analysisResult = extractedDetails;
              } else {
                // Don't show raw JSON — show a clean fallback message
                analysisResult = predictedNumberPlate && predictedNumberPlate !== "Unknown"
                  ? `Vehicle with plate **${predictedNumberPlate}** detected. Detailed narrative could not be parsed from AI response.`
                  : "Analysis completed. Detailed narrative could not be extracted from AI response.";
              }
            }
          }

          const uniqueId = crypto.randomBytes(4).toString("hex").toUpperCase();
          const finalAnalysisResult = `${analysisResult}\n\n---\nReport Unique Reference: KP-IA-${report.id}-${uniqueId}`;

          // Always ensure we have alternative plate candidates (using normalized plate)
          const normalizedPrimary = normalizePlate(predictedNumberPlate);
          const finalCandidates = generatePlateCandidates(normalizedPrimary, candidates);

          await storage.updateReport(report.id, {
            status: "completed",
            predictedNumberPlate: normalizedPrimary,
            candidates: finalCandidates,
            analysisResult: finalAnalysisResult,
          });

        } catch (error: any) {
          console.error("Gemini analysis failed:", error);

          // If the local ML service already found a plate, save that as a
          // completed result instead of marking the whole report as failed.
          if (predictedNumberPlate && predictedNumberPlate !== "Unknown") {
            const mlPlate = normalizePlate(predictedNumberPlate);
            console.log(`[Analysis] Gemini unavailable — saving ML-only result (plate: ${mlPlate})`);
            const uniqueId = crypto.randomBytes(4).toString("hex").toUpperCase();
            const mlCandidates = generatePlateCandidates(mlPlate, candidates);
            await storage.updateReport(report.id, {
              status: "completed",
              predictedNumberPlate: mlPlate,
              candidates: mlCandidates,
              analysisResult:
                `### ML Model Detection Result\n` +
                `The number plate **${mlPlate}** was detected by the local ANPR ML model.\n\n` +
                `⚠ *AI narrative analysis was unavailable (Gemini API error). ` +
                `The plate detection above is based solely on the local YOLOv8 + EasyOCR model.*\n\n` +
                `---\nReport Unique Reference: KP-IA-${report.id}-${uniqueId}`,
            });
          } else {
            // ML also found nothing — mark as failed
            const errorDetail = error.message || String(error);
            await storage.updateReport(report.id, {
              status: "failed",
              analysisResult: `Image analysis failed: ${errorDetail}`,
            });
          }

        }

      })();

      res.status(201).json(report);

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.video.create.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const input = api.video.create.input.parse(req.body);
      const userId = (req.user as any).id;

      // 1. Save Video to local storage
      const fileName = `${crypto.randomBytes(16).toString("hex")}-${input.filename}`;
      const uploadDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, fileName);

      // Extract the raw base64 data
      const base64Data = input.video.split(",")[1] || input.video;
      await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));
      const videoUrl = `/uploads/${fileName}`;

      // 2. Create initial report record
      const report = await storage.createReport({
        userId,
        videoUrl,
        originalFilename: input.filename,
        analysisType: "video",
        status: "processing"
      });

      // 3. Process Video (Real Gemini Forensic Analysis)
      (async () => {
        try {
          // If a frame was captured and cropped, analyze it as an image instead of the video
          if (input.frameImage) {
            console.log("[Video Analysis] Frame image provided, analyzing cropped region as image");

            const base64Parts = input.frameImage.split(",");
            let mimeType = "image/jpeg";
            let base64Data = input.frameImage;

            // --- First: Try Local ML Service on Frame ---
            console.log("[Video Analysis] Querying local ML service for frame plate...");
            const localPrediction = await predictNumberPlate(input.frameImage);
            let predictedNumberPlate = "Unknown";
            let candidates: { plate: string, score: number }[] = [];

            if (localPrediction) {
              predictedNumberPlate = localPrediction.plate;
              candidates = localPrediction.candidates || [];
              console.log(`[Video Analysis] Local ML predicted plate: ${predictedNumberPlate}`);
            }

            // --- Second: Run Gemini for Forensic Description on Frame ---

            if (base64Parts.length > 1) {
              const mimeMatch = base64Parts[0].match(/:(.*?);/);
              if (mimeMatch) mimeType = mimeMatch[1];
              base64Data = base64Parts[1];
            }

            const currentTimeIST = new Date().toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              dateStyle: 'full',
              timeStyle: 'long'
            });

            const prompt = `
              FORENSIC IMAGE ANALYSIS - DETAILED INCIDENT RECONSTRUCTION
              CURRENT ANALYSIS TIME (IST): ${currentTimeIST}
              
              You are a senior forensic analyst examining this image (captured and cropped from CCTV/video footage) 
              for a police investigation. Your task is to provide an EXTREMELY DETAILED, professional forensic 
              analysis that reconstructs the incident and describes EVERYTHING visible in the image.
              
              Write a comprehensive narrative report in 5-8 detailed paragraphs. Be thorough and observant.
              
              CRITICAL INSTRUCTIONS:
              1. Examine EVERY detail in the image carefully
              2. Read and transcribe ALL visible text (license plates, signs, advertisements, shop names, vehicle text)
              3. Describe the incident/scene as if you're reconstructing what happened
              4. Use professional forensic language but be descriptive and detailed
              5. Include measurements, positions, directions, and spatial relationships
              6. Note any evidence of movement, damage, or unusual conditions
              7. Mention the analysis time (${currentTimeIST}) if relevant to the findings.
              
              YOUR ANALYSIS MUST COVER:
              
              PARAGRAPH 1 - INCIDENT OVERVIEW & CONTEXT:
              - What type of incident/scene is this? (traffic violation, accident, surveillance, etc.)
              - Overall scene description and initial observations
              - Time indicators (lighting suggests morning/afternoon/evening/night)
              - Weather and environmental conditions
              - State that this analysis was performed at ${currentTimeIST}
              
              PARAGRAPH 2 - PRIMARY VEHICLE DETAILED DESCRIPTION:
              - Exact color, make, model, body type (sedan/SUV/truck/etc.)
              - License plate number (CRITICAL: Read carefully, use Indian patterns like KL-XX-XX-XXXX)
              - Distinctive features: dents, scratches, modifications, stickers, accessories
              - Vehicle condition and age indicators
              - Position and orientation of the vehicle
              - Any visible damage or unusual conditions
              
              PARAGRAPH 3 - TEXT & SIGNAGE EXTRACTION:
              - ALL readable text on signs, boards, advertisements
              - Shop names, business names, street names
              - Any text on vehicles (company names, slogans)
              - Road signs and traffic information
              - Building numbers or identifiers
              - Any other written information visible
              
              PARAGRAPH 4 - LOCATION & ENVIRONMENT:
              - Type of location (urban/suburban/rural, commercial/residential)
              - Road type and condition (highway/street/lane, paved/unpaved)
              - Visible landmarks (buildings, structures, monuments)
              - Background details (trees, poles, barriers, fences)
              - Infrastructure elements (streetlights, traffic signals, CCTV cameras)
              
              PARAGRAPH 5 - ADDITIONAL VEHICLES & PEOPLE:
              - Other vehicles: count, types, colors, positions, directions
              - People: count, positions, activities, clothing descriptions
              - Interactions between people/vehicles
              - Movement indicators or trajectories
              
              PARAGRAPH 6 - TRAFFIC & SAFETY ELEMENTS:
              - Traffic signals, signs, road markings
              - Lane markings, zebra crossings, speed bumps
              - Safety barriers, guardrails, dividers
              - Parking indicators, no-parking zones
              
              PARAGRAPH 7 - TECHNICAL ASSESSMENT:
              - Image quality: resolution, clarity, focus
              - Lighting conditions and visibility
              - Any blur, obstruction, or quality issues
              - Camera angle and perspective
              - Timestamp or metadata if visible
              
              PARAGRAPH 8 - FORENSIC CONCLUSIONS:
              - Key evidence identified
              - Confidence level in license plate reading
              - Any anomalies or points of interest
              - Recommendations for investigation
              
              Return ONLY valid JSON with this structure:
              {
                "numberPlate": "most likely plate number or Unknown",
                "alternativePlates": [
                  { "plate": "second most likely reading", "confidence": 0.85, "reason": "brief reason e.g. digit 0 vs O ambiguity" },
                  { "plate": "third possible reading", "confidence": 0.72, "reason": "brief reason" }
                ],
                "detailedAnalysis": "Your comprehensive 5-8 paragraph forensic narrative covering all aspects above. Use \\n\\n to separate paragraphs. Be extremely detailed and thorough."
              }

              RULES FOR alternativePlates:
              - Always include 3-5 alternatives even if you are highly confident (show the runner-up interpretations)
              - Consider common OCR/visual ambiguities: 0/O, 1/I/L, 8/B, 5/S, 2/Z, 6/G, 7/T
              - confidence must be a number between 0.0 and 1.0
              - If the plate is completely unreadable return an empty array []
              
              CRITICAL REMINDERS:
              - Write in complete, flowing sentences (NOT bullet points)
              - Be EXTREMELY detailed - this is a forensic investigation
              - Read ALL visible text and include it in your analysis
              - Describe spatial relationships and positions precisely
              - Use professional forensic terminology
              - Each paragraph should be substantial (4-6 sentences minimum)
            `;

            const response = await geminiGenerateWithRetry({
              model: "gemini-2.5-flash",
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: mimeType,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
              config: {
                responseMimeType: "application/json",
                temperature: 0.0,
                candidateCount: 1,
                maxOutputTokens: 4000,
              },
            });

            const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log(`[Gemini Frame Analysis Raw Response]: ${resultText}`);

            let analysisResult = "Could not analyze frame.";

            if (resultText) {
              try {
                let cleanJson = resultText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
                const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
                if (jsonMatch) cleanJson = jsonMatch[0];
                const forParsing = cleanJson.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
                const json = JSON.parse(forParsing);

                if (predictedNumberPlate === "Unknown" && json.numberPlate && json.numberPlate !== "Unknown") {
                  predictedNumberPlate = json.numberPlate;
                  console.log(`[Video Analysis] Used Gemini's frame plate prediction: ${predictedNumberPlate}`);
                }

                // Merge Gemini alternative plates into candidates
                if (json.alternativePlates && Array.isArray(json.alternativePlates)) {
                  const geminiCandidates = (json.alternativePlates as any[])
                    .filter((a: any) => a.plate && a.plate !== "Unknown" && a.plate !== predictedNumberPlate)
                    .map((a: any) => ({ plate: String(a.plate), score: Number(a.confidence) || 0.5 }));
                  if (geminiCandidates.length > 0) {
                    const primaryCandidate = { plate: predictedNumberPlate, score: 1.0 };
                    const existingPlates = candidates.map(c => c.plate);
                    candidates = [
                      ...(existingPlates.includes(predictedNumberPlate) ? [] : [primaryCandidate]),
                      ...candidates,
                      ...geminiCandidates.filter(g => !existingPlates.includes(g.plate)),
                    ];
                    console.log(`[Video Analysis] Merged ${geminiCandidates.length} Gemini alternative(s) into candidates`);
                  }
                }

                analysisResult = json.detailedAnalysis || "Analysis completed but no detailed narrative was generated.";
              } catch (e) {
                console.warn("[Gemini Frame Analysis] JSON.parse failed, using raw text");
                analysisResult = resultText;
              }
            }

            const uniqueId = crypto.randomBytes(4).toString("hex").toUpperCase();
            const finalAnalysisResult = `${analysisResult}\n\n---\nReport Unique Reference: KP-VA-${report.id}-${uniqueId}\n(Analyzed from captured and cropped video frame)`;

            const frameFinalCandidates = generatePlateCandidates(predictedNumberPlate, candidates);

            await storage.updateReport(report.id, {
              status: "completed",
              predictedNumberPlate,
              candidates: frameFinalCandidates,
              analysisResult: finalAnalysisResult,
            });


            console.log(`[Video Analysis] Frame analysis completed for report ${report.id}`);
            return; // Exit early, don't process the full video
          }

          // Original video processing logic (if no frame was captured)
          console.log("[Video Analysis] No frame image provided, processing full video");
          const base64Parts = input.video.split(",");
          let mimeType = "video/mp4";
          let base64Data = input.video;

          let predictedNumberPlate = "Unknown";

          if (base64Parts.length > 1) {
            const mimeMatch = base64Parts[0].match(/:(.*?);/);
            if (mimeMatch) mimeType = mimeMatch[1];
            base64Data = base64Parts[1];
          }

          const prompt = `
            FORENSIC VIDEO ANALYSIS - Provide a comprehensive narrative description.
            
            You are a forensic analyst examining this video for a police investigation. Write a detailed, 
            professional narrative analysis describing everything you observe across the video frames. 
            Use complete sentences and paragraphs to create a flowing, comprehensive report.
            
            Your analysis should cover ALL of the following aspects in narrative form:
            
            1. PRIMARY VEHICLE: Describe the main vehicle's color, type, make, model, and any distinctive features
            2. LICENSE PLATE: Identify and reconstruct the vehicle number plate (use Indian patterns like KL-XX-XX-XXXX, AP-XX-X-XXXX)
            3. SCENE SETTING: Describe the time of day, weather conditions, lighting, and overall environment
            4. LOCATION CONTEXT: Describe the type of area (urban/rural), road conditions, and any landmarks
            5. VISIBLE OBJECTS: Describe all significant objects in the scene (barriers, poles, signs, buildings)
            6. TEXT & SIGNAGE: Mention any readable text, shop names, signs, or advertisements
            7. OTHER VEHICLES: Describe any other vehicles visible, including their type, color, and position
            8. PEOPLE: Describe any people visible, their count, position, and what they appear to be doing
            9. TRAFFIC ELEMENTS: Describe traffic signals, road signs, lane markings, or pedestrian crossings
            10. VIDEO QUALITY: Assess the clarity, blur level, and overall visibility of the video
            
            Return ONLY valid JSON with this structure:
            {
              "numberPlate": "reconstructed plate number or Unknown",
              "detailedAnalysis": "A comprehensive narrative description in 3-5 paragraphs covering all the aspects above. Write in complete sentences describing the scene, vehicles, people, environment, and all observable details in a flowing, professional forensic report style."
            }
            
            IMPORTANT: The "detailedAnalysis" field should be a well-written narrative with proper paragraphs, 
            NOT bullet points or lists. Use \\n\\n to separate paragraphs.
          `;

          const response = await geminiGenerateWithRetry({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
              temperature: 0.0,
              candidateCount: 1,
              maxOutputTokens: 2000,
            },
          });

          const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text;
          console.log(`[Gemini Video Analysis Raw Response]: ${resultText}`);

          let analysisResult = "Could not analyze video sequence.";

          if (resultText) {
            try {
              // --- ULTIMATE JSON ROBUSTNESS ---
              let cleanJson = resultText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
              const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
              if (jsonMatch) cleanJson = jsonMatch[0];
              const forParsing = cleanJson.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

              console.log(`[Gemini Video Analysis] Cleaned JSON for parsing: ${forParsing}`);
              const json = JSON.parse(forParsing);

              if (predictedNumberPlate === "Unknown" && json.numberPlate && json.numberPlate !== "Unknown") {
                predictedNumberPlate = json.numberPlate;
                console.log(`[Video Analysis] Used Gemini's video plate prediction: ${predictedNumberPlate}`);
              }

              // Build formatted analysis from structured data (same as image analysis)
              let formattedAnalysis = "";

              if (json.vehicleDetails) {
                formattedAnalysis += "### Primary Vehicle Details\n";
                formattedAnalysis += `• Color: ${json.vehicleDetails.color || 'Unknown'}\n`;
                formattedAnalysis += `• Type: ${json.vehicleDetails.type || 'Unknown'}\n`;
                formattedAnalysis += `• Make: ${json.vehicleDetails.make || 'Unknown'}\n`;
                formattedAnalysis += `• Model: ${json.vehicleDetails.model || 'Unknown'}\n\n`;
              }

              if (json.sceneContext) {
                formattedAnalysis += "### Scene Context\n";
                formattedAnalysis += `• Time of Day: ${json.sceneContext.timeOfDay || 'Unknown'}\n`;
                formattedAnalysis += `• Weather: ${json.sceneContext.weather || 'Unknown'}\n`;
                formattedAnalysis += `• Lighting: ${json.sceneContext.lighting || 'Unknown'}\n\n`;
              }

              if (json.objects && json.objects.length > 0) {
                formattedAnalysis += "### Objects Detected\n";
                json.objects.forEach((obj: string) => {
                  formattedAnalysis += `• ${obj}\n`;
                });
                formattedAnalysis += "\n";
              }

              if (json.additionalText && json.additionalText.length > 0) {
                formattedAnalysis += "### Additional Text Detected\n";
                json.additionalText.forEach((text: string) => {
                  formattedAnalysis += `• ${text}\n`;
                });
                formattedAnalysis += "\n";
              }

              if (json.otherVehicles && json.otherVehicles.length > 0) {
                formattedAnalysis += "### Other Vehicles\n";
                json.otherVehicles.forEach((vehicle: any) => {
                  formattedAnalysis += `• ${vehicle.type || 'Vehicle'} (${vehicle.color || 'Unknown color'}) - ${vehicle.position || 'Position unknown'}\n`;
                });
                formattedAnalysis += "\n";
              }

              if (json.people) {
                formattedAnalysis += "### People Detected\n";
                formattedAnalysis += `• Count: ${json.people.count || 0}\n`;
                if (json.people.descriptions && json.people.descriptions.length > 0) {
                  json.people.descriptions.forEach((desc: string) => {
                    formattedAnalysis += `• ${desc}\n`;
                  });
                }
                formattedAnalysis += "\n";
              }

              if (json.landmarks && json.landmarks.length > 0) {
                formattedAnalysis += "### Landmarks\n";
                json.landmarks.forEach((landmark: string) => {
                  formattedAnalysis += `• ${landmark}\n`;
                });
                formattedAnalysis += "\n";
              }

              if (json.trafficElements && json.trafficElements.length > 0) {
                formattedAnalysis += "### Traffic Elements\n";
                json.trafficElements.forEach((element: string) => {
                  formattedAnalysis += `• ${element}\n`;
                });
                formattedAnalysis += "\n";
              }

              if (json.environment) {
                formattedAnalysis += "### Environment\n";
                formattedAnalysis += `${json.environment}\n\n`;
              }

              if (json.qualityAssessment) {
                formattedAnalysis += "### Video Quality Assessment\n";
                formattedAnalysis += `• Clarity: ${json.qualityAssessment.clarity || 'Unknown'}\n`;
                formattedAnalysis += `• Blur Level: ${json.qualityAssessment.blur || 'Unknown'}\n`;
                formattedAnalysis += `• Visibility: ${json.qualityAssessment.visibility || 'Unknown'}\n`;
              }

              analysisResult = json.detailedAnalysis || "Analysis completed but no detailed narrative was generated.";

            } catch (e) {
              console.warn("[Gemini Video Analysis] JSON.parse failed, falling back to regex extraction.");

              const extractedPlate = extractJsonField(resultText, "numberPlate");
              const extractedDetails = extractJsonField(resultText, "detailedAnalysis");

              if (extractedPlate) predictedNumberPlate = extractedPlate;
              if (extractedDetails) {
                analysisResult = extractedDetails;
              } else {
                analysisResult = resultText;
              }
            }
          }

          const uniqueId = crypto.randomBytes(4).toString("hex").toUpperCase();
          const finalAnalysisResult = `${analysisResult}\n\n---\nReport Unique Reference: KP-VA-${report.id}-${uniqueId}`;

          await storage.updateReport(report.id, {
            status: "completed",
            predictedNumberPlate,
            analysisResult: finalAnalysisResult,
          });

        } catch (error: any) {
          console.error("Video analysis failed:", error);
          const errorDetail = error.message || String(error);
          await storage.updateReport(report.id, {
            status: "failed",
            analysisResult: `Video analysis failed: ${errorDetail}`,
          });
        }
      })();

      res.status(201).json(report);

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.reports.list.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = (req.user as any).id;
    const reports = await storage.getUserReports(userId);
    res.json(reports);
  });

  app.get(api.reports.get.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const report = await storage.getReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    // Check ownership
    const userId = (req.user as any).id;
    if (report.userId !== userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(report);
  });

  app.delete(api.reports.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id as string);
    const report = await storage.getReport(id);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Check ownership
    const userId = (req.user as any).id;
    if (report.userId !== userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // 1. Delete associated files from uploads folder
      const filesToDelete: string[] = [];

      console.log(`[Delete Report] Processing deletion for report ${id}`);
      console.log(`[Delete Report] Report imageUrl: ${report.imageUrl}`);
      console.log(`[Delete Report] Report videoUrl: ${report.videoUrl}`);

      // Check for image file
      if (report.imageUrl && report.imageUrl.startsWith("/uploads/")) {
        const fileName = report.imageUrl.replace("/uploads/", "");
        filesToDelete.push(fileName);
        console.log(`[Delete Report] Added image file to deletion list: ${fileName}`);
      }

      // Check for video file
      if (report.videoUrl && report.videoUrl.startsWith("/uploads/")) {
        const fileName = report.videoUrl.replace("/uploads/", "");
        filesToDelete.push(fileName);
        console.log(`[Delete Report] Added video file to deletion list: ${fileName}`);
      }

      console.log(`[Delete Report] Total files to delete: ${filesToDelete.length}`);

      // Delete all associated files
      for (const fileName of filesToDelete) {
        const filePath = path.join(process.cwd(), "uploads", fileName);
        console.log(`[Delete Report] Attempting to delete: ${filePath}`);
        try {
          await fs.unlink(filePath);
          console.log(`[Delete Report] ✓ Successfully deleted file: ${fileName}`);
        } catch (unlinkErr) {
          console.error(`[Delete Report] ✗ Failed to delete file: ${filePath}`, unlinkErr);
          // Continue with deletion even if file delete fails (file might not exist)
        }
      }

      // 2. Delete database record
      await storage.deleteReport(id);
      console.log(`[Delete Report] Successfully deleted report ${id} and ${filesToDelete.length} associated file(s)`);

      res.sendStatus(200);
    } catch (error) {
      console.error("Deletion failed:", error);
      res.status(500).json({ message: "Deletion failed" });
    }
  });

  // User Profile API
  app.patch(api.user.update.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const input = api.user.update.input.parse(req.body);
      const userId = (req.user as any).id;
      const updates: any = { ...input };

      // Handle profile photo upload if provided as base64
      if (input.profileImageUrl && input.profileImageUrl.startsWith("data:image/")) {
        const fileName = `${crypto.randomBytes(16).toString("hex")}-profile.png`;
        const uploadDir = path.join(process.cwd(), "uploads", "profiles");
        await fs.mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, fileName);

        const base64Data = input.profileImageUrl.replace(/^data:image\/\w+;base64,/, "");
        await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));
        updates.profileImageUrl = `/uploads/profiles/${fileName}`;
      }

      const updatedUser = await storage.updateUser(userId, updates);

      // Update session user
      req.login(updatedUser, (err) => {
        if (err) return res.status(500).json({ message: "Failed to update session" });
        res.json(updatedUser);
      });

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/admin/export-users", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const csvPath = path.join(process.cwd(), "documents", "officer_credentials.csv");
    if (existsSync(csvPath)) {
      res.download(csvPath, "officer_credentials.csv");
    } else {
      res.status(404).json({ message: "CSV file not found. Try updating your profile first." });
    }
  });

  return httpServer;
}
