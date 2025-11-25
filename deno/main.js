import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

console.log("Roblox publishing proxy listening on http://localhost:8000");

async function handler(req) {
  // Handle CORS preflight requests for the /publish endpoint
  if (req.method === "OPTIONS" && new URL(req.url).pathname === "/publish") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*", // In a real app, lock this to your web editor's origin
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Only handle POST requests to /publish
  const url = new URL(req.url);
  if (req.method !== "POST" || url.pathname !== "/publish") {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const {
      universeId,
      placeId,
      apiKey,
      versionType,
      rbxlxContent
    } = await req.json();

    if (!universeId || !placeId || !apiKey || !rbxlxContent || !versionType) {
      return new Response(JSON.stringify({ message: "Missing required fields in request body." }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const robloxApiUrl = `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=${versionType}`;
    console.log(`Forwarding request to Roblox API: ${robloxApiUrl}`);

    const robloxResponse = await fetch(robloxApiUrl, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/octet-stream",
      },
      body: new TextEncoder().encode(rbxlxContent),
    });

    const responseBody = await robloxResponse.text();
    const responseHeaders = {
      "Content-Type": robloxResponse.headers.get("Content-Type") || "application/json",
      "Access-Control-Allow-Origin": "*",
    };

    console.log(`Roblox API responded with status: ${robloxResponse.status}`);

    return new Response(responseBody, {
      status: robloxResponse.status,
      statusText: robloxResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ message: "Internal Server Error", error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}

await serve(handler, { port: 8000 });