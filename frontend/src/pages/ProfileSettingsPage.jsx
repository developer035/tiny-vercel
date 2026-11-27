import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { ArrowLeft, Settings, User } from 'lucide-react';

export default function ProfileSettingsPage() {
  const { user } = useUser();

  const displayName = user?.fullName || user?.username || 'Authenticated User';
  const email = user?.primaryEmailAddress?.emailAddress || 'No email on file';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-800/90 bg-[#121214] p-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Profile Settings
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Account details and preferences workspace
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-lg border border-zinc-800/70 bg-[#09090b] p-4">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={displayName}
              className="h-12 w-12 rounded-full border border-zinc-700 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400">
              <User className="h-5 w-5" />
            </div>
          )}

          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate">
              {displayName}
            </p>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{email}</p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-4 text-xs text-zinc-400">
          Profile settings sections and custom account controls will be added here.
        </div>
      </div>
    </div>
  );
}
