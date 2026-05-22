import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }
    const ai = new GoogleGenAI({ apiKey });

    try {
        console.log("Sending request to gemini-1.5-flash...");
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: "Hello" }] }],
        });

        console.log("Response received!");
        console.log(response.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (error: any) {
        console.error("Error testing Gemini:", error.message);
    }
}

testGemini();
