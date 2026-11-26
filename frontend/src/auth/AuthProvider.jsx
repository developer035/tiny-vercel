import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { ui } from '@clerk/ui';
import { KeyRound } from 'lucide-react';
import { CONFIG } from '../config';
import { clerkAppearance } from './appearance';

function MissingClerkKeyFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-zinc-100 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#121214] p-8 shadow-2xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-amber-400">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-white">
          Clerk Publishable Key Required
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Add <code className="text-zinc-200 font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> to{' '}
          <code className="text-zinc-200 font-mono">frontend/.env</code> or authenticate with the Clerk CLI and pull keys for your application.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-800 bg-[#09090b] p-3 text-[11px] font-mono text-zinc-300">
{`npx -y clerk@latest auth login
npx -y clerk@latest link --app app_3MeDzcJ3IlJiqGrGZc2Q1gz9pjA
npx -y clerk@latest env pull`}
        </pre>
      </div>
    </div>
  );
}

export default function AuthProvider({ children }) {
  const navigate = useNavigate();

  if (!CONFIG.CLERK_PUBLISHABLE_KEY) {
    return <MissingClerkKeyFallback />;
  }

  return (
    <ClerkProvider
      publishableKey={CONFIG.CLERK_PUBLISHABLE_KEY}
      ui={ui}
      appearance={clerkAppearance}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
