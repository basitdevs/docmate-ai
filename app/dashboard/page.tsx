"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import withAuth from "@/components/withAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Home } from "lucide-react";

interface Conversation {
  id: string;
  transcript: string;
  soapNotes: string;
  createdAt: Timestamp;
}

function DashboardPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, "conversations"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        const userConversations = querySnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Conversation)
        );

        setConversations(userConversations);
      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white'>
      <div className='container mx-auto px-4 py-8'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex justify-between items-center mb-8'>
            <h1 className='text-4xl font-bold text-slate-100'>My Records</h1>
            <Link
              href='/'
              className='flex items-center gap-2 rounded-lg bg-slate-700/50 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-blue-600 hover:text-white'
            >
              <Home className='h-4 w-4' />
              <span>Back to App</span>
            </Link>
          </div>

          {isLoading ? (
            <div className='flex justify-center items-center py-20'>
              <Loader2 className='h-12 w-12 animate-spin text-slate-400' />
            </div>
          ) : conversations.length > 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {conversations.map((convo) => (
                <Link href={`/dashboard/${convo.id}`} key={convo.id}>
                  <Card className='bg-slate-800/50 border-slate-700 hover:border-blue-500 transition-all duration-300 cursor-pointer h-full'>
                    <CardHeader>
                      <CardTitle className='text-blue-400 flex items-center gap-3'>
                        <FileText className='w-6 h-6' />
                        <span>
                          {convo.createdAt?.toDate().toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className='text-slate-400 text-sm line-clamp-3'>
                        {convo.transcript
                          ? `${convo.transcript.substring(0, 150)}...`
                          : "No transcript available."}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className='text-center py-20 bg-slate-800/30 rounded-lg'>
              <h2 className='text-2xl font-semibold text-slate-300'>No Records Found</h2>
              <p className='text-slate-400 mt-2'>You haven't saved any conversations yet.</p>
              <Link
                href='/'
                className='mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2 font-semibold hover:bg-blue-700'
              >
                Start a New Transcription
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default withAuth(DashboardPage);
