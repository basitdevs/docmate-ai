import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google API key is not configured on the server." },
        { status: 500 }
      );
    }

    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const generationConfig = {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 8192,
    };

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    const prompt = `Convert this doctor-patient transcript into professional clinical notes in SOAP format.

    Requirements:
    - Always output in English.
    - Detect and translate if the input is in another language, noting the original language.
    - Use a clean, structured format. Do not use asterisks or bullet points for list items.
    - Use proper medical terminology and clinical language.
    - Leave space for the doctor to refine the Assessment and Plan sections.
    - Flag any uncertainties clearly.
    - Remove all personal identifying information (PII).

    Format the output exactly as follows:

    ORIGINAL LANGUAGE: [Language detected]

    TRANSLATED TRANSCRIPT:
    [If translation was needed, provide the translated version here]

    SOAP NOTES:

    SUBJECTIVE:
    [Patient's reported symptoms, concerns, and history]

    OBJECTIVE:
    [Physical examination findings, vital signs, test results mentioned in the conversation]

    ASSESSMENT:
    [Clinical impression and potential diagnosis based on the conversation]

    PLAN:
    [Treatment plan, medications, follow-up instructions discussed]

    UNCERTAINTIES:
    [Any unclear or uncertain information from the transcript]


    Medical Conversation Transcript:
    ${transcript}`;

    const stream = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream.stream) {
          const chunkText = chunk.text();
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ text: chunkText })}\n\n`)
          );
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in generate-notes API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: `Failed to generate notes. Reason: ${errorMessage}` },
      { status: 500 }
    );
  }
}
