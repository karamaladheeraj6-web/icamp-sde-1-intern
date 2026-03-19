// index.ts
import { serve } from "bun";

// Mocking the FedWatch API endpoint (CME Group data)
const FEDWATCH_API_URL = "https://www.cmegroup.com";

async function fetchFedWatchData() {
    try {
        // Using Bun's built-in fast fetch
        const response = await fetch(FEDWATCH_API_URL);
        const html = await response.text();
        
        // In a real scenario, you would parse the HTML or use a proper JSON API 
        // if provided by a data provider (e.g., Bloomberg, Refinitiv).
        // Based on FedWatch methodology (Source 0.4.4)
        return {
            meeting: "April 2026",
            noChangeProb: "84%", // Example data from source 0.4.5
            hike25Prob: "14.9%",
            hike50Prob: "0.5%",
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error("Error fetching FedWatch data:", error);
        return null;
    }
}

// Create a simple HTTP server to serve the insights
serve({
    port: 3000,
    async fetch(request) {
        const data = await fetchFedWatchData();
        return new Response(JSON.stringify(data, null, 2), {
            headers: { "Content-Type": "application/json" },
        });
    },
});

console.log("FedWatch Bun Service running on http://localhost:3000");