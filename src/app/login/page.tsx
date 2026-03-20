"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, isFirebaseConfigured } from "../../lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleProvider = new GoogleAuthProvider();

  const submit = async (mode: "login" | "signup") => {
    if (!auth) {
      setError("Firebase is not configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!auth) {
      setError("Firebase is not configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-200 px-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white/80 p-8 text-neutral-900 shadow-xl shadow-black/10">
        <div className="mb-2 w-fit rounded-xl border border-sky-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center gap-3">
            <Image
              src="/freezezone-logo.png"
              alt="Freezezone logo"
              width={56}
              height={56}
              className="h-10 w-10 object-contain"
              priority
              unoptimized
            />
            <Image
              src="/freezezone-wordmark.png"
              alt="Freezezone"
              width={240}
              height={54}
              className="h-8 w-auto object-contain"
              priority
              unoptimized
            />
          </div>
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Access</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in to Freezezone</h1>
        {!isFirebaseConfigured && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Add Firebase environment variables to enable authentication.
          </div>
        )}
        <div className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-semibold text-neutral-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
              placeholder="you@example.com"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-neutral-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
              placeholder="••••••••"
            />
          </label>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => submit("login")}
              disabled={loading}
              className="w-full rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-md shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Working..." : "Login"}
            </button>
            <button
              onClick={() => submit("signup")}
              disabled={loading}
              className="w-full rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create account
            </button>
            <button
              onClick={loginWithGoogle}
              disabled={loading}
              className="w-full rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
