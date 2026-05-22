import { pgTable, text, serial, integer, timestamp, varchar, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Export auth and chat models from blueprints
export * from "./models/auth";
export * from "./models/chat";

import { users } from "./models/auth";

// === REPORTS SCHEMA ===
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id), // Link to auth user
  imageUrl: text("image_url"), // Base64 or URL (optional for video)
  videoUrl: text("video_url"), // Base64 or URL (optional for image)
  originalFilename: text("original_filename").notNull(),
  predictedNumberPlate: text("predicted_number_plate"),
  candidates: json("candidates").$type<{ plate: string, score: number }[]>(), // Store multiple plate predictions
  analysisResult: text("analysis_result"), // Full analysis text
  status: text("status").$type<"pending" | "processing" | "completed" | "failed">().notNull().default("pending"),
  analysisType: text("analysis_type").$type<"image" | "video">().notNull().default("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
  predictedNumberPlate: true,
  candidates: true,
  analysisResult: true
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

// Request Types
export type CreateReportRequest = {
  image: string; // Base64
  filename: string;
};

export type CreateVideoReportRequest = {
  video: string; // Base64
  filename: string;
  frameImage?: string; // Optional: captured frame from video
};

// Response Types
export type ReportResponse = Report;
