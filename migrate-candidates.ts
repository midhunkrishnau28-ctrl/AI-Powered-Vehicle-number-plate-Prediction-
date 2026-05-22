import 'dotenv/config';
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function push() {
    console.log("Adding candidates array column...");
    try {
        await db.execute(sql`ALTER TABLE reports ADD COLUMN candidates json`);
        console.log("Done!");
    } catch (e) {
        console.error("Already exists or error", e);
    }
    process.exit(0);
}

push();
