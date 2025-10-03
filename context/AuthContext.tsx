"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  sendPasswordResetEmail,
  User
} from "firebase/auth";
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation"; // Import from next/navigation

// Define the type for the context value
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// Create the context with a default undefined value
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter(); // Use the Next.js router

    const signUp = async (email: string, password: string) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Create a user document in Firestore
            await setDoc(doc(db, "users", userCredential.user.uid), {
                email: userCredential.user.email,
                role: "user" // Default role
            });
            router.push("/"); // Redirect to the main page after sign up
        } catch (error) {
            console.error("Error signing up:", error);
            throw error; // Rethrow to handle in the component
        }
    };

    const login = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // No need to check roles here, Firebase handles the auth state.
            // Redirection can be handled by a protected route component.
            router.push("/"); // Redirect to the main page after login
        } catch (error) {
            console.error("Error logging in:", error);
            throw error; // Rethrow to handle in the component
        }
    };

    const logOut = async () => {
        await signOut(auth);
        router.push("/login"); // Redirect to login page after logout
    };


    const resetPassword = (email: string) => {
        return sendPasswordResetEmail(auth, email);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const value = {
        user,
        loading,
        signUp,
        login,
        logOut,
        resetPassword
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}