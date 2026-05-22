import "dotenv/config";
import { db } from "../server/db";
import { users } from "../shared/models/auth";
import { reports } from "../shared/schema";

async function diagnose() {
    console.log("--- DATABASE DIAGNOSTIC REPORT ---");
    try {
        const allUsers = await db.select().from(users);
        console.log(`Users Found: ${allUsers.length}`);
        allUsers.forEach(u => console.log(` - Officer: ${u.username} (${u.firstName} ${u.lastName})`));

        const allReports = await db.select().from(reports);
        console.log(`Reports Found: ${allReports.length}`);
        allReports.forEach(r => console.log(` - Report ID ${r.id}: ${r.originalFilename} (Status: ${r.status})`));

        console.log("----------------------------------");
    } catch (error) {
        console.error("Database Connection Failed:", error);
    } finally {
        process.exit();
    }
}

diagnose();
