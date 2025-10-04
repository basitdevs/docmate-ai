"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-2'>
        {/* --- STYLE UPDATE: Label text color --- */}
        <Label htmlFor='signin-email' className='text-slate-400'>
          Email
        </Label>
        {/* --- STYLE UPDATE: Input fields for dark mode --- */}
        <Input
          id='signin-email'
          type='email'
          placeholder='m@example.com'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className='bg-slate-900/50 border-slate-700 text-white focus:ring-blue-500'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='signin-password' className='text-slate-400'>
          Password
        </Label>
        <div className='relative'>
          <Input
            id='signin-password'
            type={showPassword ? "text" : "password"}
            placeholder='Enter your password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className='bg-slate-900/50 border-slate-700 text-white focus:ring-blue-500 pr-10'
          />
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className='h-4 w-4 text-slate-400' />
            ) : (
              <Eye className='h-4 w-4 text-slate-400' />
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className='flex items-center gap-3 rounded-md bg-red-900/30 border border-red-500/50 p-3 text-sm text-red-300'>
          <AlertCircle className='h-4 w-4' />
          <p>{error}</p>
        </div>
      )}

      <Button
        type='submit'
        className='w-full bg-blue-600 hover:bg-blue-700 text-white'
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : "Sign In"}
      </Button>
    </form>
  );
}
