'use client';

// src/components/AuthButton.tsx
// Seamless Supabase Authentication for PromptFM
// Uses React Portal to escape navbar backdrop-blur stacking context,
// ensuring the modal is always centered on the screen.

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { LogIn, LogOut, User as UserIcon, X, Loader2, Disc, Mail } from 'lucide-react';
import { type OAuthProvider } from '@/lib/auth/providers';

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);

    // 1. Initial user check
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    // 2. Real-time auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setAuthLoading(true);
    setStatusMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMsg({ type: 'error', text: message });
      setAuthLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setAuthLoading(true);
    setStatusMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      setStatusMsg({ type: 'success', text: 'Magic link sent! Check your inbox to sign in.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMsg({ type: 'error', text: message });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const modalContent = isOpen && !user && mounted ? (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors p-1"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5 pt-1">
          <h2 className="text-xl font-bold text-white tracking-tight">Welcome to PromptFM</h2>
          <p className="text-xs text-zinc-400">
            Sign in to upvote songs, submit AI tracks, and request airplay.
          </p>
        </div>

        {/* Status alerts */}
        {statusMsg && (
          <div
            className={`text-xs p-3 rounded-xl border ${
              statusMsg.type === 'error'
                ? 'bg-red-950/60 border-red-800 text-red-300'
                : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => handleOAuthSignIn('google')}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-white font-medium text-xs transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.7 0 3 .6 3.9 1.5l2.9-2.9C17 1.9 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.6 2.8C6.4 7.2 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.5 14.9c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.8l3.6-2.8z"
              />
              <path
                fill="#34A853"
                d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.6-2.1-6.5-5.1L1.9 16.5C3.7 20.3 7.5 23.5 12 23.5z"
              />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => handleOAuthSignIn('discord')}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-indigo-500/30 bg-[#5865F2]/15 hover:bg-[#5865F2]/25 text-indigo-100 font-medium text-xs transition-colors"
          >
            <svg className="w-4 h-4 fill-[#5865F2]" viewBox="0 0 127.14 96.36">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
            </svg>
            <span>Continue with Discord</span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthSignIn('twitter')}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-white font-medium text-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Continue with X</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-zinc-800 w-full" />
          <span className="bg-zinc-900 px-3 text-[10px] text-zinc-500 uppercase tracking-wider">or email</span>
        </div>

        {/* Magic Link Form */}
        <form onSubmit={handleMagicLink} className="space-y-2.5">
          <div className="relative">
            <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={authLoading || !email}
            className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {authLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send Magic Link'}
          </button>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Navbar Avatar / Sign In Button */}
      {user ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
            {user.user_metadata?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <UserIcon className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-xs text-zinc-300 font-medium max-w-[120px] truncate">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="text-zinc-500 hover:text-zinc-300 p-1.5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition-colors"
        >
          <LogIn className="w-3.5 h-3.5 text-emerald-400" />
          Sign In
        </button>
      )}

      {/* Render modal directly in document.body via Portal */}
      {mounted && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
    </>
  );
}
