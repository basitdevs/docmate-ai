import { type NextRequest, NextResponse } from "next/server";
import { SpeechClient } from "@google-cloud/speech";
import { google } from "@google-cloud/speech/build/protos/protos";

interface TranscriptionConfig {
  languageCode: string;
  model: "medical_conversation" | "default";
}

type AudioEncoding = google.cloud.speech.v1.RecognitionConfig.AudioEncoding;
const AudioEncoding = google.cloud.speech.v1.RecognitionConfig.AudioEncoding;

function getAudioEncoding(mimeType: string): AudioEncoding | null {
  const mimeTypeMap = new Map<string, AudioEncoding>([
    ["audio/webm", AudioEncoding.WEBM_OPUS],
    ["audio/webm;codecs=opus", AudioEncoding.WEBM_OPUS],
    ["audio/wav", AudioEncoding.LINEAR16],
    ["audio/x-wav", AudioEncoding.LINEAR16],
    ["audio/mp3", AudioEncoding.MP3],
    ["audio/mpeg", AudioEncoding.MP3],
    ["audio/ogg", AudioEncoding.OGG_OPUS],
    ["audio/ogg;codecs=opus", AudioEncoding.OGG_OPUS],
    ["audio/flac", AudioEncoding.FLAC],
  ]);
  return mimeTypeMap.get(mimeType.toLowerCase()) || null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const configString = formData.get("config") as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
    }

    const encoding = getAudioEncoding(audioFile.type);
    if (!encoding) {
      return NextResponse.json(
        { error: `Unsupported audio format: ${audioFile.type}.` },
        { status: 400 }
      );
    }

    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be under 10MB for synchronous recognition." },
        { status: 400 }
      );
    }

    let speechClient;
    if (process.env.GOOGLE_CREDENTIALS_BASE64) {
      const decodedCredentials = Buffer.from(
        process.env.GOOGLE_CREDENTIALS_BASE64,
        "base64"
      ).toString("utf-8");
      const credentials = JSON.parse(decodedCredentials);
      speechClient = new SpeechClient({ credentials });
    } else {
      console.warn("WARN: GOOGLE_CREDENTIALS_BASE64 not set. Using default credentials.");
      speechClient = new SpeechClient();
    }

    let frontendConfig: TranscriptionConfig = { languageCode: "en-US", model: "default" };
    if (configString) {
      try {
        frontendConfig = JSON.parse(configString);
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid transcription config provided." },
          { status: 400 }
        );
      }
    }

    const recognitionConfig: google.cloud.speech.v1.IRecognitionConfig = {
      encoding: encoding,

      sampleRateHertz: 48000,
      languageCode: frontendConfig.languageCode,
      model: frontendConfig.model,
      enableAutomaticPunctuation: true,
      diarizationConfig: {
        enableSpeakerDiarization: true,
        minSpeakerCount: 2,
        maxSpeakerCount: 2,
      },
    };

    const audioBytes = Buffer.from(await audioFile.arrayBuffer()).toString("base64");
    const requestPayload: google.cloud.speech.v1.IRecognizeRequest = {
      config: recognitionConfig,
      audio: { content: audioBytes },
    };

    const [response] = await speechClient.recognize(requestPayload);

    const results = response.results;
    if (
      !results ||
      results.length === 0 ||
      !results[0].alternatives ||
      results[0].alternatives.length === 0
    ) {
      return NextResponse.json({ error: "No speech detected in the audio." }, { status: 400 });
    }

    const wordsInfo = results
      .map((result) => result.alternatives?.[0]?.words)
      .flat()
      .filter(Boolean) as google.cloud.speech.v1.IWordInfo[];

    if (wordsInfo.length === 0) {
      const simpleTranscript = results
        .map((result) => result.alternatives?.[0].transcript)
        .join("\n");
      return NextResponse.json({ transcript: simpleTranscript });
    }

    let speakerTranscript = "";
    let currentSpeaker = -1;

    wordsInfo.forEach((wordInfo) => {
      if (wordInfo.speakerTag !== currentSpeaker) {
        currentSpeaker = wordInfo.speakerTag || 0;
        speakerTranscript += `\n\n**Speaker ${currentSpeaker}:** `;
      }
      speakerTranscript += wordInfo.word + " ";
    });

    const fullTranscript = speakerTranscript.trim();

    return NextResponse.json({
      transcript: fullTranscript,
      confidence: results[0].alternatives[0].confidence || 0.95,
      provider: "Google Cloud Speech-to-Text",
      model: recognitionConfig.model,
    });
  } catch (error) {
    console.error("Transcription API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: `Failed to transcribe audio. Reason: ${errorMessage}` },
      { status: 500 }
    );
  }
}
