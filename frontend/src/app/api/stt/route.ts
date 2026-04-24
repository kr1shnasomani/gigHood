import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const language = formData.get("language") as string || "en";

    if (!file) {
      return NextResponse.json({ detail: "No file provided" }, { status: 400 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error("GROQ_API_KEY not configured");
      return NextResponse.json({ detail: "GROQ_API_KEY not configured" }, { status: 500 });
    }

    const isoLang = language.split('-')[0];
    const supportedLangs = ['en', 'hi', 'ta', 'te', 'kn', 'mr', 'bn', 'as'];
    
    const groqFormData = new FormData();
    groqFormData.append("file", file);
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("response_format", "json");
    
    if (supportedLangs.includes(isoLang)) {
      groqFormData.append("language", isoLang);
    }

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
      },
      body: groqFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", errorText);
      return NextResponse.json({ detail: "Failed to transcribe audio" }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json({ transcript: result.text || "" });

  } catch (error: unknown) {
    console.error("STT Route Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
