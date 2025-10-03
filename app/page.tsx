"use client";

import type React from "react";
import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Mic,
  MicOff,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  Upload,
  Save,
  LogOut,
} from "lucide-react";
import type { TranscriptionResponse } from "@/types/speech";
import withAuth from "@/components/withAuth";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

type RecordingState = "idle" | "recording" | "processing" | "complete";

interface TranscriptionConfig {
  languageCode: string;
  model: "medical_conversation" | "default";
}

function DocMate() {
  const { user, logOut } = useAuth();

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Ready to record medical conversation or upload audio file");
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [transcriptionConfig, setTranscriptionConfig] = useState<TranscriptionConfig>({
    languageCode: "en-US",
    model: "medical_conversation",
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateStatus = useCallback((message: string, isError = false) => {
    setStatus(message);
    setError(isError ? message : null);
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
    updateStatus(`Processing uploaded file: ${file.name}...`);
    try {
      await transcribeAudio(file);
    } catch (err) {
      console.error("File upload error:", err);
      updateStatus("Failed to process uploaded file. Please try again.", true);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const startRecording = async () => {
    try {
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
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
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
    } catch (err) {
      console.error("Error starting recording:", err);
      updateStatus("Could not access microphone. Please check permissions and try again.", true);
      setRecordingState("idle");
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (recordingState === "recording") {
      updateStatus("Stopping recording...");
    }
  }, [recordingState, updateStatus]);

  const transcribeAudio = async (audioData: Blob | File) => {
    try {
      updateStatus("Transcribing with AI...");
      const formData = new FormData();
      formData.append(
        "audio",
        audioData instanceof File ? audioData : new File([audioData], "recording.webm")
      );

      formData.append("config", JSON.stringify(transcriptionConfig));

      const response = await fetch("/api/transcribe", { method: "POST", body: formData });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: TranscriptionResponse = await response.json();
      setTranscript(result.transcript);
      setRecordingState("complete");
      updateStatus("Transcription complete.");
    } catch (err) {
      console.error("Transcription error:", err);
      setRecordingState("idle");
      updateStatus(
        `Transcription failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        true
      );
    }
  };

  const generateClinicalNotes = async () => {
    if (!transcript.trim()) {
      updateStatus("Please record and transcribe audio first.", true);
      return;
    }

    setIsGeneratingNotes(true);
    setNotes("");
    updateStatus("Generating clinical notes with Gemini Flash...");

    try {
      // The API route now handles the API key securely on the server.
      const response = await fetch("/api/generate-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // We only need to send the transcript, as the prompt is constructed on the backend.
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let notesContent = "";

      // Process the streamed response from the Gemini API
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n"); // The backend sends data chunks separated by double newlines

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.substring(6); // Remove "data: " prefix
            if (data.trim() === "[DONE]") continue; // Ignore the final DONE signal if present
            try {
              // The backend sends a simple JSON object: { text: "..." }
              const json = JSON.parse(data);
              notesContent += json.text || "";
              setNotes(notesContent); // Update the state progressively for a real-time effect
            } catch (e) {
              console.error("Failed to parse streaming JSON:", e, "Received data:", data);
            }
          }
        }
      }

      updateStatus("Clinical notes generated successfully!");
    } catch (err) {
      console.error("Error generating clinical notes:", err);
      updateStatus(
        `Failed to generate notes: ${
          err instanceof Error ? err.message : "An unknown error occurred."
        }`,
        true
      );
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const saveConversation = async () => {
    if (!transcript || !notes) {
      updateStatus("Nothing to save. Please generate a transcript and notes first.", true);
      return;
    }
    if (!user) {
      updateStatus("You must be logged in to save conversations.", true);
      return;
    }
    setIsSaving(true);
    updateStatus("Saving to your records...");
    try {
      await addDoc(collection(db, "conversations"), {
        userId: user.uid,
        transcript,
        soapNotes: notes,
        createdAt: serverTimestamp(),
      });
      updateStatus("Conversation saved successfully!");
    } catch (err) {
      console.error("Error saving to Firestore:", err);
      updateStatus(
        `Failed to save conversation: ${err instanceof Error ? err.message : "Unknown error"}`,
        true
      );
    } finally {
      setIsSaving(false);
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
    if (recordingState === "recording") {
      return {
        onClick: stopRecording,
        className: "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30",
        icon: <MicOff className='w-5 h-5 mr-2' />,
        text: "Stop Recording",
      };
    }
    if (recordingState === "processing") {
      return {
        onClick: () => {},
        className: "bg-yellow-600 cursor-not-allowed",
        icon: <Loader2 className='w-5 h-5 mr-2 animate-spin' />,
        text: "Processing...",
      };
    }
    return {
      onClick: startRecording,
      className: "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30",
      icon: <Mic className='w-5 h-5 mr-2' />,
      text: "Start Recording",
    };
  };

  const buttonConfig = getRecordingButtonConfig();
  const isBusy =
    recordingState === "recording" || recordingState === "processing" || isUploadingFile;

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white'>
      <input
        ref={fileInputRef}
        type='file'
        accept='audio/*,.mp3,.wav,.m4a,.webm,.mp4'
        onChange={handleFileUpload}
        className='hidden'
      />

      <div className='container mx-auto px-4 py-8'>
        <div className='max-w-7xl mx-auto'>
          <button
            onClick={logOut}
            className='absolute top-5 right-5 flex items-center gap-2 rounded-lg bg-red-600/30 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-red-500/80 hover:text-white'
          >
            <LogOut className='h-4 w-4' />
            Logout
          </button>

          {/* --- Header --- */}
          <div className='text-center mb-8'>
            <h1 className='text-4xl sm:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-400 mb-4'>
              DocMate Pro
            </h1>
            <p className='text-lg text-slate-300 max-w-3xl mx-auto'>
              AI-powered medical transcription and intelligent clinical notes generation.
            </p>
          </div>

          {/* --- Main Controls --- */}
          <Card className='mb-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm'>
            <CardContent className='p-6 lg:p-8 text-center'>
              <div className='flex justify-center mb-6'>
                <div
                  className={`rounded-full p-8 transition-all duration-300 ${
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
                    <MicOff className='w-16 h-16 text-white' />
                  ) : isBusy ? (
                    <Loader2 className='w-16 h-16 text-white animate-spin' />
                  ) : recordingState === "complete" ? (
                    <CheckCircle className='w-16 h-16 text-white' />
                  ) : (
                    <Mic className='w-16 h-16 text-white' />
                  )}
                </div>
              </div>

              <div className='flex items-center justify-center gap-2 min-h-[2rem] mb-6'>
                {getStatusIcon()}
                <p className={`text-lg font-medium ${error ? "text-red-400" : "text-slate-300"}`}>
                  {status}
                </p>
              </div>

              {/* --- Action Buttons --- */}
              <div className='flex flex-wrap justify-center gap-4'>
                <button
                  onClick={buttonConfig.onClick}
                  disabled={recordingState === "processing" || isUploadingFile}
                  className={`w-full sm:w-auto px-6 flex items-center justify-center gap-2 rounded-lg sm:px-8 py-3 text-lg font-semibold transition-all duration-200 ${buttonConfig.className}`}
                >
                  {buttonConfig.icon}
                  {buttonConfig.text}
                </button>
                <button
                  onClick={triggerFileUpload}
                  disabled={isBusy}
                  className='w-full sm:w-auto px-6 flex items-center justify-center gap-2 rounded-lg sm:px-8 py-3 text-lg font-semibold bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/30 transition-all duration-200 disabled:opacity-50'
                >
                  {isUploadingFile ? (
                    <Loader2 className='w-5 h-5 mr-2 animate-spin' />
                  ) : (
                    <Upload className='w-5 h-5 mr-2' />
                  )}
                  Upload Audio
                </button>
                <button
                  onClick={generateClinicalNotes}
                  disabled={isGeneratingNotes || !transcript.trim() || isBusy}
                  className='w-full sm:w-auto px-6 flex items-center justify-center gap-2 rounded-lg sm:px-8 py-3 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all duration-200 disabled:opacity-50'
                >
                  {isGeneratingNotes ? (
                    <Loader2 className='w-5 h-5 mr-2 animate-spin' />
                  ) : (
                    <FileText className='w-5 h-5 mr-2' />
                  )}
                  Generate Notes
                </button>
                <button
                  onClick={saveConversation}
                  disabled={isSaving || !notes || !transcript}
                  className='w-full sm:w-auto px-6 flex items-center justify-center gap-2 rounded-lg sm:px-8 py-3 text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all duration-200 disabled:opacity-50'
                >
                  {isSaving ? (
                    <Loader2 className='w-5 h-5 mr-2 animate-spin' />
                  ) : (
                    <Save className='w-5 h-5 mr-2' />
                  )}
                  Save Record
                </button>
              </div>
            </CardContent>
          </Card>

          {/* --- Transcription Settings --- */}
          <Card className='mb-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm'>
            <CardHeader className='pb-4'>
              <CardTitle className='text-xl text-slate-300'>Transcription Settings</CardTitle>
            </CardHeader>
            <CardContent className='grid sm:grid-cols-2 gap-6'>
              <div>
                <label htmlFor='language' className='block text-sm font-medium text-slate-400 mb-2'>
                  Language
                </label>
                <select
                  id='language'
                  value={transcriptionConfig.languageCode}
                  onChange={(e) =>
                    setTranscriptionConfig((prev) => ({ ...prev, languageCode: e.target.value }))
                  }
                  className='w-full bg-slate-900/50 border border-slate-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                >
                  <option value='en-US'>English (US)</option>
                  <option value='en-GB'>English (UK)</option>
                  <option value='es-ES'>Spanish (Spain)</option>
                </select>
              </div>
              <div>
                <label htmlFor='model' className='block text-sm font-medium text-slate-400 mb-2'>
                  Recognition Model
                </label>
                <select
                  id='model'
                  value={transcriptionConfig.model}
                  onChange={(e) =>
                    setTranscriptionConfig((prev) => ({ ...prev, model: e.target.value as any }))
                  }
                  className='w-full bg-slate-900/50 border border-slate-600 rounded-md p-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                >
                  <option value='medical_conversation'>Medical Conversation</option>
                  <option value='default'>Default</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* --- Transcript and Notes Display --- */}
          <div className='grid lg:grid-cols-2 gap-8'>
            <Card className='bg-slate-800/50 border-slate-700 backdrop-blur-sm'>
              <CardHeader>
                <CardTitle className='text-2xl text-blue-400 flex items-center gap-3'>
                  <Mic className='w-7 h-7' />
                  <span>Medical Transcript</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='bg-slate-900/50 rounded-lg p-4 min-h-[400px] max-h-[600px] overflow-y-auto border border-slate-700/50'>
                  <pre className='whitespace-pre-wrap text-sm font-mono text-slate-200 leading-relaxed'>
                    {transcript || "Medical conversation transcript will appear here..."}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <Card className='bg-slate-800/50 border-slate-700 backdrop-blur-sm'>
              <CardHeader>
                <CardTitle className='text-2xl text-emerald-400 flex items-center gap-3'>
                  <FileText className='w-7 h-7' />
                  <span>Clinical Notes (SOAP)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='bg-slate-900/50 rounded-lg p-4 min-h-[400px] max-h-[600px] overflow-y-auto border border-slate-700/50'>
                  {notes ? (
                    <div className='text-sm text-slate-200 leading-relaxed space-y-4'>
                      {notes.split("\n").map((line, index) => {
                        const trimmedLine = line.trim();
                        if (
                          trimmedLine.match(
                            /^(ORIGINAL LANGUAGE|TRANSLATED TRANSCRIPT|SOAP NOTES|SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN|UNCERTAINTIES):/
                          )
                        ) {
                          return (
                            <div
                              key={index}
                              className='font-bold text-emerald-300 text-base mt-4 mb-2 border-b border-slate-600 pb-1'
                            >
                              {trimmedLine}
                            </div>
                          );
                        }
                        if (!trimmedLine) return <div key={index} className='h-2'></div>;
                        return (
                          <div key={index} className='text-slate-200 ml-2'>
                            {trimmedLine}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className='text-slate-400 italic text-center py-20 px-4'>
                      Professional clinical notes will be generated here...
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

export default withAuth(DocMate);
