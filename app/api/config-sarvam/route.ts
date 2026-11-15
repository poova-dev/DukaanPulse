import { response, sameOrigin } from "@/lib/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return response({ error: "forbidden" }, 403);
  try {
    const body = (await req.json()) as { key?: string };
    const key = body.key?.trim() || "";

    if (!key || key.length < 10 || /[\r\n]/.test(key)) {
      return response({ error: "invalidKey", message: "API key must be at least 10 characters." }, 400);
    }

    // Write to .dev.vars for Wrangler / Vite local environment
    const devVarsPath = path.join(process.cwd(), ".dev.vars");
    await fs.writeFile(devVarsPath, `SARVAM_API_KEY=${JSON.stringify(key)}\n`, {
      mode: 0o600,
    });

    // Also update runtime process.env so it's active immediately
    process.env.SARVAM_API_KEY = key;

    return response({
      success: true,
      message: "Sarvam API Key successfully configured and activated.",
    });
  } catch (err) {
    console.error("Failed to save Sarvam key:", err);
    return response({ error: "saveFailed", message: "Failed to persist key locally." }, 500);
  }
}
