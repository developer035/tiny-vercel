import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import GithubIcon from './GithubIcon';
import ProfileMenu from '../auth/ProfileMenu';
import { CONFIG } from '../config';

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              {/* Minimalist Vercel style triangle */}
              <div className="h-6 w-6 flex items-center justify-center">
                <svg
                  viewBox="0 0 100 85"
                  className="h-5 w-5 fill-white group-hover:opacity-80 transition-opacity"
                >
                  <polygon points="50,0 100,85 0,85" />
                </svg>
              </div>
              <span className="font-semibold tracking-tight text-white text-sm">
                Tiny Vercel
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  location.pathname === '/'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                Dashboard
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* System Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400 font-mono text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API: {new URL(CONFIG.API_BASE_URL).port || '80'}
            </div>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
              title="GitHub"
            >
              <GithubIcon className="h-4 w-4" />
            </a>

            <ProfileMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-900 py-6 text-xs text-zinc-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-4">
            <span className="text-zinc-400">Tiny Vercel • Automated Cloud Deployment Engine</span>
            <span className="hidden sm:inline text-zinc-700">•</span>
            <div className="flex items-center gap-3">
              <Link to="/privacy" className="text-zinc-400 hover:text-zinc-200 transition-colors">
                Privacy Policy
              </Link>
              <span className="text-zinc-700">•</span>
              <Link to="/terms" className="text-zinc-400 hover:text-zinc-200 transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
          <span className="font-mono text-[11px] text-zinc-500">
            Proxy: {CONFIG.PROXY_PROTOCOL}://*.{CONFIG.PROXY_BASE_DOMAIN}
          </span>
        </div>
      </footer>
    </div>
  );
}
