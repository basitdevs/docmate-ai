"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { signUp } = useAuth();

  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      await signUp(email, password);
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email address is already in use.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Failed to create an account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='signup-email' className="text-slate-400">Email</Label>
        <Input
          id='signup-email'
          type='email'
          placeholder='m@example.com'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className='bg-slate-900/50 border-slate-700 text-white focus:ring-blue-500'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='signup-password' className="text-slate-400">Password</Label>
        <div className='relative'>
          <Input
            id='signup-password'
            type={showPassword ? "text" : "password"}
            placeholder='Create a password (min. 6 characters)'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className='bg-slate-900/50 border-slate-700 text-white focus:ring-blue-500 pr-10'
          />
          <Button type='button' variant='ghost' size='sm' className='absolute right-0 top-0 h-full' onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff className='h-4 w-4 text-slate-400' /> : <Eye className='h-4 w-4 text-slate-400' />}
          </Button>
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='signup-confirm-password' className="text-slate-400">Confirm Password</Label>
        <div className='relative'>
          <Input
            id='signup-confirm-password'
            type={showConfirmPassword ? "text" : "password"}
            placeholder='Confirm your password'
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className='bg-slate-900/50 border-slate-700 text-white focus:ring-blue-500 pr-10'
          />
          <Button type='button' variant='ghost' size='sm' className='absolute right-0 top-0 h-full' onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
            {showConfirmPassword ? <EyeOff className='h-4 w-4 text-slate-400' /> : <Eye className='h-4 w-4 text-slate-400' />}
          </Button>
        </div>
        {confirmPassword && !passwordsMatch && (
            <p className="text-sm text-red-400 mt-1">Passwords do not match.</p>
        )}
      </div>
      
      {error && (
        <div className="flex items-center gap-3 rounded-md bg-red-900/30 border border-red-500/50 p-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4" />
          <p>{error}</p>
        </div>
      )}

      <Button type='submit' className='w-full bg-blue-600 hover:bg-blue-700 text-white' disabled={isLoading || !passwordsMatch || !password}>
        {isLoading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : "Create Account"}
      </Button>
    </form>
  );
}