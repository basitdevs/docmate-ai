"use client";

import type React from "react";

import { useState, useRef, useCallback } from "react";
// import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, FileText, Loader2, AlertCircle, CheckCircle, Upload } from "lucide-react";
import type { TranscriptionResponse } from "@/types/speech";

type RecordingState = "idle" | "recording" | "processing" | "complete";

export default function DocMate() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Ready to record medical conversation or upload audio file");
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateStatus = useCallback((message: string, isError = false) => {
    setStatus(message);
    if (isError) {
      setError(message);
    } else {
      setError(null);
    }
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "audio/mp3",
      "audio/mpeg",
      "audio/wav",
      "audio/m4a",
      "audio/webm",
      "audio/mp4",
    ];
    if (
      !allowedTypes.includes(file.type) &&
      !file.name.toLowerCase().match(/\.(mp3|wav|m4a|webm|mp4)$/)
    ) {
      updateStatus("Please upload a valid audio file (MP3, WAV, M4A, WebM, or MP4)", true);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      updateStatus("File size must be less than 25MB", true);
      return;
    }

    setIsUploadingFile(true);
    setError(null);
    updateStatus(`Processing uploaded file: ${file.name}...`);

    try {
      await transcribeAudio(file);
    } catch (error) {
      console.error("File upload error:", error);
      updateStatus("Failed to process uploaded file. Please try again.", true);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const startRecording = async () => {
    try {
      setError(null);
      updateStatus("Requesting microphone access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const options = { mimeType: "audio/webm;codecs=opus" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = "audio/webm";
      }

      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setRecordingState("processing");
        updateStatus("Processing audio recording...");

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        await transcribeAudio(audioBlob);
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        updateStatus("Recording error occurred. Please try again.", true);
        stopRecording();
      };

      mediaRecorderRef.current.start(1000);
      setRecordingState("recording");
      updateStatus("Recording in progress... Speak clearly into your microphone");
    } catch (error) {
      console.error("Error starting recording:", error);
      updateStatus("Could not access microphone. Please check permissions and try again.", true);
      setRecordingState("idle");
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (recordingState === "recording") {
      updateStatus("Stopping recording...");
    }
  }, [recordingState, updateStatus]);

  const transcribeAudio = async (audioData: Blob | File) => {
    try {
      updateStatus("Transcribing with AI...");

      const formData = new FormData();
      if (audioData instanceof File) {
        formData.append("audio", audioData);
      } else {
        formData.append("audio", audioData, "recording.webm");
      }

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: TranscriptionResponse = await response.json();

      setTranscript(result.transcript);
      setConfidence(result.confidence);
      setRecordingState("complete");
      updateStatus(`Transcription complete `);
      // with! Confidence: ${Math.round(
      //   (result.confidence || 0) * 100
      // )}%
    } catch (error) {
      console.error("Transcription error:", error);
      setRecordingState("idle");
      updateStatus(
        `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        true
      );
    }
  };

  const generateClinicalNotes = async () => {
    if (!transcript.trim()) {
      updateStatus("Please record and transcribe audio first.", true);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
    if (!apiKey) {
      updateStatus(
        "Groq API key not configured. Please add NEXT_PUBLIC_GROQ_API_KEY to your environment variables.",
        true
      );
      return;
    }

    setIsGeneratingNotes(true);
    setNotes("");
    updateStatus("Generating clinical notes in SOAP format...");

    const prompt = `Convert this doctor-patient transcript into professional clinical notes in SOAP format.

Requirements:
- Always output in English
- Detect and translate if input is in another language, noting the original language
- Use clean, structured format without asterisks or bullet points
- Use proper medical terminology and clinical language
- Leave space for doctor to refine Assessment/Plan sections
- Include Consultation Pattern Summary if past consultations are mentioned
- Flag uncertainties clearly
- Remove all personal identifying information

Format the output as follows:

ORIGINAL LANGUAGE: [Language detected]

TRANSLATED TRANSCRIPT:
[If translation was needed, provide translated version]

SOAP NOTES:

SUBJECTIVE:
[Patient's reported symptoms, concerns, and history]

OBJECTIVE:
[Physical examination findings, vital signs, test results]

ASSESSMENT:
[Clinical impression and diagnosis]

PLAN:
[Treatment plan, medications, follow-up instructions]

CONSULTATION PATTERN SUMMARY:
[Previous consultations mentioned, if any]

UNCERTAINTIES:
[Any unclear or uncertain information]


Medical Conversation Transcript:
${transcript}`;
    // Transcript confidence level: ${confidence ? Math.round(confidence * 100) + "%" : "High (Whisper AI)"}

    try {
      const payload = {
        messages: [{ role: "user", content: prompt }],
        model: "llama3-8b-8192",
        temperature: 0.2,
        max_tokens: 4096,
        top_p: 0.9,
        stream: true,
      };

      const response = await fetch("/api/generate-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, apiKey }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let notesContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.substring(6);
            if (data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const content = json.choices[0]?.delta?.content || "";
              notesContent += content;
              setNotes(notesContent);
            } catch (e) {
              console.error("Failed to parse streaming JSON:", e);
            }
          }
        }
      }

      updateStatus("Clinical notes generated successfully!");
    } catch (error) {
      console.error("Error generating clinical notes:", error);
      updateStatus(
        "Failed to generate clinical notes. Please check your API configuration and try again.",
        true
      );
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const getStatusIcon = () => {
    if (error) return <AlertCircle className='w-5 h-5 text-red-400' />;
    if (recordingState === "complete") return <CheckCircle className='w-5 h-5 text-green-400' />;
    if (recordingState === "processing" || isUploadingFile)
      return <Loader2 className='w-5 h-5 animate-spin text-blue-400' />;
    return null;
  };

  const getRecordingButtonConfig = () => {
    switch (recordingState) {
      case "recording":
        return {
          onClick: stopRecording,
          className: "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30",
          icon: <MicOff className='w-5 h-5 mr-2' />,
          text: "Stop Recording",
        };
      case "processing":
        return {
          onClick: () => {},
          className: "bg-yellow-600 cursor-not-allowed",
          icon: <Loader2 className='w-5 h-5 mr-2 animate-spin' />,
          text: "Processing...",
        };
      default:
        return {
          onClick: startRecording,
          className: "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30",
          icon: <Mic className='w-5 h-5 mr-2' />,
          text: "Start Recording",
        };
    }
  };

  const buttonConfig = getRecordingButtonConfig();

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white'>
      <input
        ref={fileInputRef}
        type='file'
        accept='audio/*,.mp3,.wav,.m4a,.webm,.mp4'
        onChange={handleFileUpload}
        className='hidden'
      />

      <div className='container mx-auto px-4 py-4 sm:py-8'>
        <div className='max-w-7xl mx-auto'>
          <div className='text-center mb-6 sm:mb-8'>
            <h1 className='text-4xl sm:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-400 mb-3 sm:mb-4'>
              DocMate Pro
            </h1>
            <p className='text-base sm:text-lg lg:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed px-2'>
              Professional AI-powered medical conversation transcription and intelligent clinical
              notes generation in SOAP format
            </p>
          </div>

          <Card className='mb-6 sm:mb-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm'>
            <CardContent className='p-4 sm:p-6 lg:p-8'>
              <div className='text-center space-y-4 sm:space-y-6'>
                <div className='flex justify-center'>
                  <div
                    className={`rounded-full p-6 sm:p-8 transition-all duration-300 ${
                      recordingState === "recording"
                        ? "bg-red-500 animate-pulse shadow-2xl shadow-red-500/50"
                        : recordingState === "processing" || isUploadingFile
                        ? "bg-yellow-500 shadow-2xl shadow-yellow-500/50"
                        : recordingState === "complete"
                        ? "bg-green-500 shadow-2xl shadow-green-500/50"
                        : "bg-blue-500 shadow-2xl shadow-blue-600/50"
                    }`}
                  >
                    {recordingState === "recording" ? (
                      <MicOff className='w-12 h-12 sm:w-16 sm:h-16 text-white' />
                    ) : recordingState === "processing" || isUploadingFile ? (
                      <Loader2 className='w-12 h-12 sm:w-16 sm:h-16 text-white animate-spin' />
                    ) : recordingState === "complete" ? (
                      <CheckCircle className='w-12 h-12 sm:w-16 sm:h-16 text-white' />
                    ) : (
                      <Mic className='w-12 h-12 sm:w-16 sm:h-16 text-white' />
                    )}
                  </div>
                </div>

                <div className='flex items-center justify-center gap-2 min-h-[2rem] px-2'>
                  {getStatusIcon()}
                  <p
                    className={`text-sm sm:text-base lg:text-lg font-medium text-center ${
                      error ? "text-red-400" : "text-slate-300"
                    }`}
                  >
                    {status}
                  </p>
                </div>

                {/* {confidence !== null && (
                  <div className="bg-slate-900/50 rounded-lg p-3 max-w-md mx-auto">
                    <p className="text-sm text-slate-400">
                      Transcription Confidence:{" "}
                      <span className="text-green-400 font-semibold">{Math.round(confidence * 100)}%</span>
                    </p>
                  </div>
                )} */}

                <div className='flex flex-col sm:flex-row justify-center gap-3 sm:gap-4'>
                  <button
                    onClick={buttonConfig.onClick}
                    disabled={recordingState === "processing" || isUploadingFile}
                    // size="lg"
                    className={`w-full sm:w-auto px-6 flex items-center gap-2 rounded-[10px] sm:px-10 py-3 sm:py-4 text-base sm:text-lg font-semibold transition-all duration-200 ${buttonConfig.className}`}
                  >
                    {buttonConfig.icon}
                    {buttonConfig.text}
                  </button>

                  <button
                    onClick={triggerFileUpload}
                    disabled={
                      recordingState === "recording" ||
                      recordingState === "processing" ||
                      isUploadingFile
                    }
                    // size="lg"
                    className='w-full sm:w-auto px-6 flex items-center gap-2 rounded-[10px] sm:px-10 py-3 sm:py-4 text-base sm:text-lg font-semibold bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/30 transition-all duration-200 disabled:opacity-50'
                  >
                    {isUploadingFile ? (
                      <Loader2 className='w-5 h-5 mr-2 animate-spin' />
                    ) : (
                      <Upload className='w-5 h-5 mr-2' />
                    )}
                    Upload Audio File
                  </button>

                  <button
                    onClick={generateClinicalNotes}
                    disabled={
                      isGeneratingNotes ||
                      !transcript.trim() ||
                      recordingState === "processing" ||
                      isUploadingFile
                    }
                    // size="lg"
                    className='w-full sm:w-auto px-6 flex items-center gap-2 rounded-[10px] sm:px-10 py-3 sm:py-4 text-base sm:text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all duration-200 disabled:opacity-50'
                  >
                    {isGeneratingNotes ? (
                      <Loader2 className='w-5 h-5 mr-2 animate-spin' />
                    ) : (
                      <FileText className='w-5 h-5 mr-2' />
                    )}
                    Generate Clinical Notes
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className='grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8'>
            <Card className='bg-slate-800/50 border-slate-700 backdrop-blur-sm'>
              <CardHeader className='pb-3 sm:pb-4'>
                <CardTitle className='text-lg sm:text-xl lg:text-2xl text-blue-400 flex items-center gap-2 sm:gap-3'>
                  <Mic className='w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7' />
                  <span className='flex-1'>Medical Conversation Transcript</span>
                  {/* <span className='text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded-full'>
                    Groq Whisper
                  </span> */}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='bg-slate-900/50 rounded-lg p-3 sm:p-4 lg:p-6 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] max-h-[500px] sm:max-h-[600px] lg:max-h-[700px] overflow-y-auto border border-slate-700/50'>
                  <pre className='whitespace-pre-wrap text-xs sm:text-sm font-mono text-slate-200 leading-relaxed'>
                    {transcript ||
                      "Medical conversation transcript will appear here after recording and processing..."}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <Card className='bg-slate-800/50 border-slate-700 backdrop-blur-sm'>
              <CardHeader className='pb-3 sm:pb-4'>
                <CardTitle className='text-lg sm:text-xl lg:text-2xl text-emerald-400 flex items-center gap-2 sm:gap-3'>
                  <FileText className='w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7' />
                  <span className='flex-1'>Clinical Notes (SOAP Format)</span>
                  <span className='text-xs bg-emerald-600/20 text-emerald-300 px-2 py-1 rounded-full'>
                    AI Generated
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='bg-slate-900/50 rounded-lg p-3 sm:p-4 lg:p-6 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] max-h-[500px] sm:max-h-[600px] lg:max-h-[700px] overflow-y-auto border border-slate-700/50'>
                  {notes ? (
                    <div className='text-xs sm:text-sm text-slate-200 leading-relaxed space-y-3 sm:space-y-4'>
                      {notes.split("\n").map((line, index) => {
                        const trimmedLine = line.trim();

                        if (
                          trimmedLine.match(
                            /^(ORIGINAL LANGUAGE|TRANSLATED TRANSCRIPT|SOAP NOTES|SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN|CONSULTATION PATTERN SUMMARY|UNCERTAINTIES):/
                          )
                        ) {
                          return (
                            <div
                              key={index}
                              className='font-bold text-emerald-300 text-sm sm:text-base mt-4 sm:mt-6 mb-2 border-b border-slate-600 pb-1'
                            >
                              {trimmedLine}
                            </div>
                          );
                        }

                        if (!trimmedLine) {
                          return <div key={index} className='h-2'></div>;
                        }

                        return (
                          <div key={index} className='text-slate-200 ml-2'>
                            {trimmedLine}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className='text-slate-400 italic text-center py-12 sm:py-16 lg:py-20 px-4'>
                      Professional clinical notes in SOAP format will be generated here from your
                      transcript...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className='mt-6 sm:mt-8 bg-slate-800/30 border-slate-700 backdrop-blur-sm'>
            <CardContent className='p-4 sm:p-6 lg:p-8'>
              <h3 className='text-lg sm:text-xl font-semibold text-slate-300 mb-3 sm:mb-4 flex items-center gap-2'>
                <Upload className='w-5 h-5 sm:w-6 sm:h-6' />
                Usage Instructions
              </h3>
              <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'>
                <div>
                  <h4 className='font-semibold text-slate-400 mb-2'>Live Recording:</h4>
                  <ol className='list-decimal list-inside space-y-1 sm:space-y-2 text-slate-400 text-xs sm:text-sm'>
                    <li>Ensure quiet environment with quality microphone</li>
                    <li>Click "Start Recording" and allow microphone access</li>
                    <li>Conduct medical conversation clearly and at normal pace</li>
                    <li>Click "Stop Recording" when consultation is complete</li>
                    <li>Wait for AI processing</li>
                  </ol>
                </div>
                <div>
                  <h4 className='font-semibold text-slate-400 mb-2'>File Upload:</h4>
                  <ol className='list-decimal list-inside space-y-1 sm:space-y-2 text-slate-400 text-xs sm:text-sm'>
                    <li>Click "Upload Audio File" button</li>
                    <li>Select MP3, WAV, M4A, WebM, or MP4 file (max 25MB)</li>
                    <li>Wait for automatic processing with AI</li>
                    <li>Review transcript accuracy before generating notes</li>
                    <li>Supported formats optimized for mobile uploads</li>
                  </ol>
                </div>
                <div className='sm:col-span-2 lg:col-span-1'>
                  <h4 className='font-semibold text-slate-400 mb-2'>Clinical Notes Generation:</h4>
                  <ol className='list-decimal list-inside space-y-1 sm:space-y-2 text-slate-400 text-xs sm:text-sm'>
                    <li>Verify transcript completeness and accuracy</li>
                    <li>Click "Generate Clinical Notes" for SOAP format</li>
                    <li>Review AI-generated notes for medical accuracy</li>
                    <li>Edit and refine Assessment/Plan sections as needed</li>
                    <li>Save or export notes to your medical records system</li>
                  </ol>
                </div>
              </div>

              <div className='mt-4 sm:mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'>
                <div className='p-3 sm:p-4 bg-blue-900/20 rounded-lg border border-blue-700/30'>
                  <h5 className='font-semibold text-blue-300 mb-2 text-sm sm:text-base'>
                    Live Recording
                  </h5>
                  <p className='text-xs sm:text-sm text-blue-200'>
                    Real-time recording with browser microphone access for immediate consultation
                    transcription.
                  </p>
                </div>
                <div className='p-3 sm:p-4 bg-purple-900/20 rounded-lg border border-purple-700/30'>
                  <h5 className='font-semibold text-purple-300 mb-2 text-sm sm:text-base'>
                    File Upload
                  </h5>
                  <p className='text-xs sm:text-sm text-purple-200'>
                    Upload pre-recorded audio files with mobile-optimized processing up to 25MB.
                  </p>
                </div>
                <div className='sm:col-span-2 lg:col-span-1 p-3 sm:p-4 bg-emerald-900/20 rounded-lg border border-emerald-700/30'>
                  <h5 className='font-semibold text-emerald-300 mb-2 text-sm sm:text-base'>
                    SOAP Format Notes
                  </h5>
                  <p className='text-xs sm:text-sm text-emerald-200'>
                    Automatically generates professional clinical documentation in standard SOAP
                    format with medical terminology.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
