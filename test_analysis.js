// Quick test to see what the analysis looks like
const sampleResponse = `{
  "numberPlate": "UP 20 TD 1076",
  "detailedAnalysis": "The image..."
}`;

try {
    const json = JSON.parse(sampleResponse);
    console.log("Number Plate:", json.numberPlate);
    console.log("Detailed Analysis:", json.detailedAnalysis);
    console.log("\nFull JSON:", JSON.stringify(json, null, 2));
} catch (e) {
    console.error("Parse error:", e);
}
