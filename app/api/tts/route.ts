const MAX_TEXT_LENGTH = 2_500;

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "ElevenLabs is not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT_LENGTH) : "";
  const voice = body?.voice === "Regulus" ? "Regulus" : "Vega";
  const language = body?.language === "kk" ? "kk" : body?.language === "ru" ? "ru" : "en";

  if (!text) {
    return Response.json({ error: "Text is required" }, { status: 400 });
  }

  // These can be replaced in .env.local with voice IDs from the user's ElevenLabs library.
  const voiceId = voice === "Regulus"
    ? process.env.ELEVENLABS_REGULUS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"
    : process.env.ELEVENLABS_VEGA_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const modelId = language === "kk" ? "eleven_v3" : "eleven_flash_v2_5";

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({ text, model_id: modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });

  if (!response.ok || !response.body) {
    const details = await response.text();
    return Response.json({ error: details || "ElevenLabs speech generation failed" }, { status: response.status || 502 });
  }

  return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
