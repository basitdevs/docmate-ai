"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Alert } from "@/components/Alert";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  const handleChange = ({ target: { name, value } }: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await login(credentials.email, credentials.password);
      // The context will handle redirection
    } catch (err: any) {
      setError("Invalid email or password. Please try again.");
      console.error(err);
    }
  };

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <div className='w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md'>
        <h2 className='text-2xl font-bold text-center text-gray-900'>Sign in to your account</h2>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {error && <Alert message={error} />}
          <div>
            <label htmlFor='email' className='text-sm font-medium text-gray-700'>
              Email
            </label>
            <input
              type='email'
              name='email'
              id='email'
              onChange={handleChange}
              className='w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              required
            />
          </div>
          <div>
            <label htmlFor='password'>Password</label>
            <input
              type='password'
              name='password'
              id='password'
              onChange={handleChange}
              className='w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
              required
            />
          </div>
          <button
            type='submit'
            className='w-full py-2 px-4 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700'
          >
            Sign In
          </button>
        </form>
        <p className='text-sm text-center text-gray-600'>
          Don't have an account?{" "}
          <Link href='/signup' className='font-medium text-indigo-600 hover:underline'>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
