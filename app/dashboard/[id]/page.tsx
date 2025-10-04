"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import withAuth from "@/components/withAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mic, FileText, ArrowLeft, AlertTriangle } from "lucide-react";
import FormattedTranscript from "@/components/FormattedTranscript";

interface Conversation {
  transcript: string;
  soapNotes: string;
  userId: string;
}

function ConversationDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const { id } = params;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;

    const fetchConversation = async () => {
      try {
        const docRef = doc(db, "conversations", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Conversation;
          // SECURITY CHECK: Ensure the fetched record belongs to the current user
          if (data.userId === user.uid) {
            setConversation(data);
          } else {
            setError("You do not have permission to view this record.");
          }
        } else {
          setError("Record not found.");
        }
      } catch (err) {
        console.error("Error fetching document:", err);
        setError("Failed to load the record.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversation();
  }, [user, id]);

  const renderFormattedNotes = (notes: string) => {
    return notes.split("\n").map((line, index) => {
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
    });
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white'>
      <div className='container mx-auto px-4 py-8'>
        <div className='max-w-7xl mx-auto'>
          <Link
            href='/dashboard'
            className='flex items-center gap-2 text-slate-300 hover:text-white mb-8 transition-colors'
          >
            <ArrowLeft className='h-5 w-5' />
            <span>Back to All Records</span>
          </Link>

          {isLoading ? (
            <div className='flex justify-center items-center py-20'>
              <Loader2 className='h-12 w-12 animate-spin text-slate-400' />
            </div>
          ) : error ? (
            <div className='text-center py-20 bg-red-900/20 rounded-lg border border-red-500/50'>
              <AlertTriangle className='h-12 w-12 mx-auto text-red-400' />
              <h2 className='mt-4 text-2xl font-semibold text-red-300'>Access Denied</h2>
              <p className='text-red-400 mt-2'>{error}</p>
            </div>
          ) : (
            conversation && (
              <div className='grid lg:grid-cols-2 gap-8'>
                <Card className='bg-slate-800/50 border-slate-700 backdrop-blur-sm'>
                  <CardHeader>
                    <CardTitle className='text-2xl text-blue-400 flex items-center gap-3'>
                      <Mic className='w-7 h-7' />
                      <span>Medical Transcript</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='bg-slate-900/50 rounded-lg p-4 max-h-[70vh] overflow-y-auto border border-slate-700/50'>
                      {/* <pre className='whitespace-pre-wrap text-sm font-mono text-slate-200 leading-relaxed'>
                        {conversation.transcript}
                      </pre> */}
                      <FormattedTranscript transcript={conversation.transcript} />
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
                    <div className='bg-slate-900/50 rounded-lg p-4 max-h-[70vh] overflow-y-auto border border-slate-700/50'>
                      <div className='text-sm text-slate-200 leading-relaxed space-y-4'>
                        {renderFormattedNotes(conversation.soapNotes)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default withAuth(ConversationDetailPage);
