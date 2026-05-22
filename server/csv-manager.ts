import fs from "fs";
import path from "path";
import { type User } from "@shared/models/auth";

const DATA_DIR = path.join(process.cwd(), "documents");
const CSV_PATH = path.join(DATA_DIR, "officer_credentials.csv");

/**
 * Escapes a string for CSV format
 */
function escapeCsv(val: any): string {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Synchronizes a list of users to the CSV file
 */
export async function syncUsersToCsv(users: User[]) {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        const headers = [
            "ID",
            "Username",
            "Password",
            "Email",
            "First Name",
            "Last Name",
            "Profile Image URL",
            "Created At"
        ];

        const rows = users.map(user => [
            user.id,
            user.username,
            user.password,
            user.email,
            user.firstName,
            user.lastName,
            user.profileImageUrl,
            user.createdAt
        ].map(escapeCsv).join(","));

        const csvContent = [headers.join(","), ...rows].join("\n");

        fs.writeFileSync(CSV_PATH, csvContent, "utf8");
        console.log(`[CSV Sync] User data synchronized to ${CSV_PATH}`);
    } catch (err) {
        console.error("[CSV Sync] Failed to synchronize users to CSV:", err);
    }
}
