import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/react';
import { LogIn, LogOut, Settings, User, UserPlus } from 'lucide-react';

export default function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  // Close popover on route navigation
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, location.search]);

  // Close popover on Escape key or click anywhere outside the menu container
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  const displayName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Account';
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const handleNavigate = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      setIsSigningOut(true);
      setIsOpen(false);
      await signOut({ redirectUrl: '/' });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div ref={menuRef} className="relative flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={isSignedIn ? `${displayName} account menu` : 'Account menu'}
        title={isSignedIn ? displayName : 'Account'}
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-zinc-500/60 ${
          isOpen
            ? 'border-zinc-500 bg-zinc-800 text-white'
            : 'border-zinc-700/80 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white'
        }`}
      >
        {isLoaded && isSignedIn && user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={displayName}
            className="h-full w-full rounded-full object-cover"
          />
        ) : isLoaded && isSignedIn && initials ? (
          <span className="text-[11px] font-semibold tracking-wide text-zinc-100">
            {initials}
          </span>
        ) : (
          <User className="h-4 w-4" />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Account options"
          className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-zinc-800 bg-[#121214] p-1.5 shadow-2xl z-50"
        >
          {isLoaded && isSignedIn ? (
            <>
              <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                <p className="text-xs font-medium text-zinc-100 truncate">
                  {displayName}
                </p>
                {email && (
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {email}
                  </p>
                )}
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => handleNavigate('/settings')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-zinc-800/80 hover:text-white transition-colors"
              >
                <Settings className="h-3.5 w-3.5 text-zinc-400" />
                <span>Profile settings</span>
              </button>

              <div className="my-1 border-t border-zinc-800/80" />

              <button
                type="button"
                role="menuitem"
                disabled={isSigningOut}
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{isSigningOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                <p className="text-xs font-medium text-zinc-100">Not signed in</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Sign in to access your dashboard
                </p>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => handleNavigate('/sign-in')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-zinc-800/80 hover:text-white transition-colors"
              >
                <LogIn className="h-3.5 w-3.5 text-zinc-400" />
                <span>Sign in</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => handleNavigate('/sign-up')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-zinc-800/80 hover:text-white transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5 text-zinc-400" />
                <span>Create account</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
