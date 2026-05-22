import pg from "pg";
import "dotenv/config";

const { Client } = pg;

async function createDb() {
    const dbName = "kerala_ai_police";
    // Connect to default postgres database to create the new one
    // Assuming default user/pass from env but changing db name to postgres
    const connectionString = process.env.DATABASE_URL?.replace(`/${dbName}`, "/postgres");

    if (!connectionString) {
        console.error("DATABASE_URL not set");
        process.exit(1);
    }

    const client = new Client({ connectionString });

    try {
        await client.connect();
        // Check if db exists
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
        if (res.rowCount === 0) {
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Database ${dbName} created successfully.`);
        } else {
            console.log(`Database ${dbName} already exists.`);
        }
    } catch (err) {
        console.error("Error creating database:", err);
    } finally {
        await client.end();
    }
}

createDb();
