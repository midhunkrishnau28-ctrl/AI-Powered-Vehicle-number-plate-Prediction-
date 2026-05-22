import { db } from "./db.js";
import { reports } from "../shared/schema.js";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Cleanup orphaned files in uploads folder
 * Removes files that don't have corresponding database records
 */
async function cleanupOrphanedFiles() {
    console.log("🧹 Starting orphaned files cleanup...\n");

    try {
        // 1. Get all reports from database
        const allReports = await db.select().from(reports);
        console.log(`📊 Found ${allReports.length} reports in database`);

        // 2. Collect all file references from database
        const referencedFiles = new Set<string>();

        for (const report of allReports) {
            if (report.imageUrl && report.imageUrl.startsWith("/uploads/")) {
                const fileName = report.imageUrl.replace("/uploads/", "");
                referencedFiles.add(fileName);
            }
            if (report.videoUrl && report.videoUrl.startsWith("/uploads/")) {
                const fileName = report.videoUrl.replace("/uploads/", "");
                referencedFiles.add(fileName);
            }
        }

        console.log(`📎 Found ${referencedFiles.size} files referenced in database\n`);

        // 3. Get all files in uploads folder
        const uploadsDir = path.join(process.cwd(), "uploads");
        let uploadedFiles: string[] = [];

        try {
            uploadedFiles = await fs.readdir(uploadsDir);
            console.log(`📁 Found ${uploadedFiles.length} files in uploads folder`);
        } catch (error) {
            console.error("❌ Error reading uploads directory:", error);
            return;
        }

        // 4. Find orphaned files (files not in database)
        const orphanedFiles: string[] = [];

        for (const fileName of uploadedFiles) {
            // Skip the profiles subdirectory
            if (fileName === "profiles") continue;

            // Check if this file is referenced in the database
            if (!referencedFiles.has(fileName)) {
                orphanedFiles.push(fileName);
            }
        }

        console.log(`\n🗑️  Found ${orphanedFiles.length} orphaned files to delete:\n`);

        if (orphanedFiles.length === 0) {
            console.log("✨ No orphaned files found! Uploads folder is clean.");
            return;
        }

        // 5. Delete orphaned files
        let deletedCount = 0;
        let failedCount = 0;

        for (const fileName of orphanedFiles) {
            const filePath = path.join(uploadsDir, fileName);

            try {
                // Get file stats to show size
                const stats = await fs.stat(filePath);
                const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

                // Delete the file
                await fs.unlink(filePath);
                console.log(`✓ Deleted: ${fileName} (${sizeInMB} MB)`);
                deletedCount++;
            } catch (error) {
                console.error(`✗ Failed to delete: ${fileName}`, error);
                failedCount++;
            }
        }

        // 6. Summary
        console.log(`\n${"=".repeat(50)}`);
        console.log("📊 CLEANUP SUMMARY");
        console.log(`${"=".repeat(50)}`);
        console.log(`Total files in uploads:     ${uploadedFiles.length}`);
        console.log(`Files referenced in DB:     ${referencedFiles.size}`);
        console.log(`Orphaned files found:       ${orphanedFiles.length}`);
        console.log(`Successfully deleted:       ${deletedCount}`);
        console.log(`Failed to delete:           ${failedCount}`);
        console.log(`${"=".repeat(50)}\n`);

        if (deletedCount > 0) {
            console.log("✅ Cleanup completed successfully!");
        }

    } catch (error) {
        console.error("❌ Error during cleanup:", error);
    }
}

// Run the cleanup
cleanupOrphanedFiles()
    .then(() => {
        console.log("\n✨ Cleanup script finished");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
