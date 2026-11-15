import { response, settings } from "@/lib/server";
export async function GET() {
  const c = settings();
  return response({
    provider: "Sarvam",
    configured: !!c.key,
    models: { speech: c.tts, transcription: c.stt, explanation: c.chat },
    dailyApplicationLimit: c.daily,
    globalDailyApplicationLimit: c.global,
    creditBalance: null,
    billingUnit: null,
    expiry: null,
    liveVerified: false,
  });
}
