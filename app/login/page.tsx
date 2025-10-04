"use client";

import { AuthTabs } from "@/components/AuthTabs";
import Loader from "@/components/Loader";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (user) {
    return <Loader />; // Or your full-screen loader
  }

  return (
    // --- STYLE UPDATE: Applied the dark mode gradient background ---
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex flex-col items-center justify-center p-4'>
      <div className='text-center mb-8'>
        {/* --- STYLE UPDATE: Matched the header style from the main app --- */}
        <h1 className='text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-400 mb-2'>
          Welcome to DocMate Pro
        </h1>
        <p className='text-slate-300'>Sign in or create an account to continue</p>
      </div>
      <AuthTabs />
    </div>
  );
}
