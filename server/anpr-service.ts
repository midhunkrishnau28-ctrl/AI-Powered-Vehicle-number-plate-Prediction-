import fetch from "node-fetch";

/**
 * Predicts the number plate from a base64 string using the local Python ML service.
 * @param imageBase64 The base64 string of the image (can include data URI prefix).
 * @returns An object containing the predicted plate and confidence score, or null if failed.
 */
export async function predictNumberPlate(imageBase64: string): Promise<{ plate: string; score: number, candidates?: { plate: string, score: number }[] } | null> {
  const serviceUrl = process.env.ANPR_SERVICE_URL;

  if (!serviceUrl) {
    console.warn("[ANPR Service] ANPR_SERVICE_URL is not configured in .env. Skipping local ML prediction.");
    return null;
  }

  try {
    const response = await fetch(serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageBase64 }),
    });

    if (!response.ok) {
      console.warn(`[ANPR Service] Failed to call local ML service. Status: ${response.status}`);
      return null;
    }

    const data: any = await response.json();

    if (data && data.plate && data.plate !== "Unknown") {
      console.log(`[ANPR Service] Successful prediction: ${data.plate} (Confidence: ${data.score})`);
      return {
        plate: data.plate,
        score: data.score,
        candidates: data.candidates || [],
      };
    }

    console.log("[ANPR Service] Local ML service returned 'Unknown' or no plate.");
    return null;
  } catch (error) {
    console.error(`[ANPR Service] Error connecting to local ML service:`, error);
    return null;
  }
}
