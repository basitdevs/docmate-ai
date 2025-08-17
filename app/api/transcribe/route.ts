import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Groq API key not configured. Please set NEXT_PUBLIC_GROQ_API_KEY environment variable.",
        },
        { status: 500 }
      );
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 25MB" }, { status: 400 });
    }

    const groqFormData = new FormData();
    groqFormData.append("file", audioFile);
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("language", "en");
    groqFormData.append("response_format", "verbose_json");
    groqFormData.append("temperature", "0.2");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", errorText);
      return NextResponse.json(
        { error: `Transcription failed: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (!result.text) {
      return NextResponse.json({ error: "No speech detected in audio" }, { status: 400 });
    }

    return NextResponse.json({
      transcript: result.text,
      confidence: 0.95, // Whisper generally has high confidence
      duration: result.duration || 0,
      language: result.language || "en",
      wordCount: result.text.split(" ").length,
      provider: "Groq Whisper",
      model: "whisper-large-v3",
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio. Please try again." },
      { status: 500 }
    );
  }
}
