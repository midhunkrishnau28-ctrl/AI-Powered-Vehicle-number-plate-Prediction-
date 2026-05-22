import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
        console.log("Listing models...");
        const response = await ai.models.list();
        if (response.models) {
            const models = response.models.map((m: any) => m.name);
            console.log("Found models:", models.length);
            models.filter((n: string) => n.includes("gemini")).forEach((n: string) => console.log(n));
        } else {
            console.log("Response:", JSON.stringify(response).substring(0, 500));
        }
    } catch (error: any) {
        console.error("Error listing models:", error.message);
    }
}

listModels();
