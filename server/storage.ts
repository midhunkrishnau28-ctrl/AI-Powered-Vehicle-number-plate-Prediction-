import { users, type User, type UpsertUser, reports, type Report, type InsertReport, otpTokens } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { syncUsersToCsv } from "./csv-manager";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;

  // Reports
  createReport(report: InsertReport): Promise<Report>;
  getReport(id: number): Promise<Report | undefined>;
  getUserReports(userId: string): Promise<Report[]>;
  updateReport(id: number, updates: Partial<Report>): Promise<Report>;
  deleteReport(id: number): Promise<void>;

  // Users
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  syncAllToCsv(): Promise<void>;

  // OTP / Password Reset
  saveOtp(email: string, otp: string, expiresAt: Date): Promise<void>;
  verifyOtp(email: string, otp: string): Promise<boolean>;
  markOtpUsed(email: string, otp: string): Promise<void>;
  resetPassword(email: string, newPassword: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    // Sync all users to CSV
    const allUsers = await db.select().from(users);
    await syncUsersToCsv(allUsers);
    return user;
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const valuesToInsert = {
      ...insertReport,
      status: insertReport.status as "pending" | "processing" | "completed" | "failed" | undefined,
      analysisType: insertReport.analysisType as "image" | "video" | undefined
    };
    const [report] = await db.insert(reports).values(valuesToInsert).returning();
    return report;
  }

  async getReport(id: number): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(eq(reports.id, id));
    return report;
  }

  async getUserReports(userId: string): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.createdAt));
  }

  async updateReport(id: number, updates: Partial<Report>): Promise<Report> {
    const [report] = await db
      .update(reports)
      .set(updates)
      .where(eq(reports.id, id))
      .returning();
    if (!report) throw new Error("Report not found");
    return report;
  }

  async deleteReport(id: number): Promise<void> {
    await db.delete(reports).where(eq(reports.id, id));
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");

    // Sync all users to CSV
    const allUsers = await db.select().from(users);
    await syncUsersToCsv(allUsers);

    return user;
  }

  async syncAllToCsv(): Promise<void> {
    const allUsers = await db.select().from(users);
    await syncUsersToCsv(allUsers);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async saveOtp(email: string, otp: string, expiresAt: Date): Promise<void> {
    // Invalidate any previous unused OTPs for this email first
    await db
      .update(otpTokens)
      .set({ used: true })
      .where(and(eq(otpTokens.email, email), eq(otpTokens.used, false)));
    // Insert new OTP
    await db.insert(otpTokens).values({ email, otp, expiresAt });
  }

  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const now = new Date();
    const [token] = await db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.email, email),
          eq(otpTokens.otp, otp),
          eq(otpTokens.used, false),
          gt(otpTokens.expiresAt, now)
        )
      );
    return !!token;
  }

  async markOtpUsed(email: string, otp: string): Promise<void> {
    await db
      .update(otpTokens)
      .set({ used: true })
      .where(and(eq(otpTokens.email, email), eq(otpTokens.otp, otp)));
  }

  async resetPassword(email: string, newPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: newPassword })
      .where(eq(users.email, email));
    // Sync CSV
    const allUsers = await db.select().from(users);
    await syncUsersToCsv(allUsers);
  }
}

export const storage = new DatabaseStorage();
storage.syncAllToCsv();
