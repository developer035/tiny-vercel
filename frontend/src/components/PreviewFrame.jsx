import React, { useState } from 'react';
import { ExternalLink, RefreshCw, Globe, Shield } from 'lucide-react';

export default function PreviewFrame({ url, subDomain }) {
  const [key, setKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleRefresh = () => {
    setLoading(true);
    setKey((prev) => prev + 1);
  };

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-[#0e0e11] overflow-hidden shadow-2xl flex flex-col">
      {/* Browser Chrome Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#16161a] px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* Traffic Dots */}
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
        </div>

        {/* URL Bar */}
        <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300 font-mono max-w-md w-full justify-center truncate">
          <Shield className="h-3 w-3 text-emerald-400 shrink-0" />
          <span className="text-zinc-500 truncate">{url || 'http://localhost'}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Reload Preview"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-zinc-300' : ''}`} />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
            title="Open in New Tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Frame Container */}
      <div className="relative w-full h-[400px] bg-zinc-950 flex items-center justify-center">
        {url ? (
          <iframe
            key={key}
            src={url}
            title={`Preview of ${subDomain}`}
            className="w-full h-full border-none"
            onLoad={() => setLoading(false)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-600">
            <Globe className="h-8 w-8 stroke-1" />
            <span className="text-xs font-mono">No live URL assigned</span>
          </div>
        )}

        {loading && url && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-2xs flex flex-col items-center justify-center gap-3 text-xs text-zinc-400">
            <RefreshCw className="h-5 w-5 animate-spin text-zinc-300" />
            <span className="font-mono">Connecting to Reverse Proxy...</span>
          </div>
        )}
      </div>
    </div>
  );
}
