import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || "";
    if (!ELEVEN_API_KEY) {
      // No key configured — return 204 so the hook can fall back to browser TTS
      return new NextResponse(null, { status: 204 });
    }

    const url = "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL";

    const payload = {
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.8
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: errText }, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600"
      }
    });

  } catch (error: unknown) {
    console.error("Next TTS Error:", error);
    const message = error instanceof Error ? error.message : "TTS request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
