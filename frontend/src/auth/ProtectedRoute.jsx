import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { Loader2, Lock, LogIn, UserPlus } from 'lucide-react';
import { resolveRedirectPath } from './appearance';

export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-300" />
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    const redirectTo = resolveRedirectPath(location, '/');
    const redirectQuery =
      redirectTo !== '/' ? `?redirect_url=${encodeURIComponent(redirectTo)}` : '';

    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800/90 bg-[#121214] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-200">
            <Lock className="h-5 w-5" />
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-white">
            Sign in to access your dashboard
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Please log in or create an account before accessing your Tiny Vercel projects, builds, and live deployment logs.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={`/sign-in${redirectQuery}`}
              state={{ redirectTo }}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors shadow-sm"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Log in</span>
            </Link>

            <Link
              to={`/sign-up${redirectQuery}`}
              state={{ redirectTo }}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Create account</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
