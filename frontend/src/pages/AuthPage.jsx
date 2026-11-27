import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { SignIn, SignUp, useAuth } from '@clerk/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { clerkAppearance, resolveRedirectPath } from '../auth/appearance';

export default function AuthPage({ mode = 'sign-in' }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const redirectTo = resolveRedirectPath(location, '/');

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-300" />
          <span>Loading authentication...</span>
        </div>
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-6">
      <div className="mb-4 w-full max-w-[400px]">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </Link>
      </div>

      {mode === 'sign-up' ? (
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl={redirectTo}
          appearance={clerkAppearance}
        />
      ) : (
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl={redirectTo}
          appearance={clerkAppearance}
        />
      )}
    </div>
  );
}
