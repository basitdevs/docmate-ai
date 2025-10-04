"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

export function AuthTabs() {
  return (
    <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm text-white">
      <Tabs defaultValue="signin">
        <TabsList className="grid w-full grid-cols-2 bg-slate-900/60">
          <TabsTrigger value="signin" className="text-slate-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Sign In
          </TabsTrigger>
          <TabsTrigger value="signup" className="text-slate-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Sign Up
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="signin">
          <CardHeader>
            <CardTitle className="text-slate-100">Welcome Back</CardTitle>
            <CardDescription className="text-slate-400">Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
        </TabsContent>

        <TabsContent value="signup">
          <CardHeader>
            <CardTitle className="text-slate-100">Create an Account</CardTitle>
            <CardDescription className="text-slate-400">Get started by creating your account below.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignUpForm />
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
}