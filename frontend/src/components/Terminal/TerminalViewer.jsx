import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Check, ArrowDown, Search, Download, Trash2 } from 'lucide-react';
import TerminalLine from './TerminalLine';

export default function TerminalViewer({ logs = [], isLive = false, deploymentId = '' }) {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const containerRef = useRef(null);
  const bottomRef = useRef(null);

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopyAll = () => {
    const rawText = logs
      .map((l) => `[${l.timestamp || ''}] [${l.stage || 'build'}] [${l.level || 'info'}] ${l.log}`)
      .join('\n');
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const rawText = logs
      .map((l) => `[${l.timestamp || ''}] [${l.stage || 'build'}] [${l.level || 'info'}] ${l.log}`)
      .join('\n');
    const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${deploymentId || 'logs'}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter logs based on search and level/stage
  const filteredLogs = logs.filter((item) => {
    const textMatches = filter
      ? String(item.log || '').toLowerCase().includes(filter.toLowerCase()) ||
        String(item.stage || '').toLowerCase().includes(filter.toLowerCase())
      : true;

    if (!textMatches) return false;

    if (categoryFilter === 'errors') {
      return item.level === 'error' || item.stage === 'error';
    }
    if (categoryFilter === 'cmd') {
      return item.level === 'cmd';
    }
    if (categoryFilter === 'steps') {
      return item.level === 'step' || item.level === 'ready';
    }

    return true;
  });

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-[#09090b] shadow-2xl overflow-hidden flex flex-col font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 bg-[#121215] px-4 py-2.5">
        {/* Left: Traffic Dots & Identifier */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="flex items-center gap-2 text-zinc-400 font-semibold text-xs tracking-tight">
            <Terminal className="h-3.5 w-3.5 text-zinc-500" />
            <span>tiny-vercel-terminal</span>
            {deploymentId && (
              <span className="text-zinc-600 font-normal">
                ~ {deploymentId.slice(0, 8)}
              </span>
            )}
          </div>

          {/* Live Indicator Badge */}
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live
            </span>
          )}
        </div>

        {/* Center: Search input */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-950/80 pl-7 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 w-36 sm:w-48 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="hidden sm:flex items-center gap-1 border border-zinc-800 rounded-md p-0.5 bg-zinc-950/60">
            {['all', 'errors', 'cmd', 'steps'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors ${
                  categoryFilter === cat
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Auto scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-colors ${
              autoScroll
                ? 'border-zinc-700 bg-zinc-800/80 text-zinc-200'
                : 'border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300'
            }`}
            title="Auto-scroll with incoming logs"
          >
            <ArrowDown className={`h-3 w-3 ${autoScroll ? 'text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Follow</span>
          </button>

          <button
            onClick={handleCopyAll}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Copy All Logs"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Download Log File"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Logs Scrollable Viewport */}
      <div
        ref={containerRef}
        className="h-[520px] overflow-y-auto overflow-x-hidden p-2 bg-[#060608] flex flex-col divide-y divide-zinc-900/40 select-text"
      >
        {filteredLogs.length > 0 ? (
          filteredLogs.map((logItem, idx) => (
            <TerminalLine
              key={logItem.event_id || `log-${idx}-${logItem.timestamp || Date.now()}`}
              logEntry={logItem}
            />
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-2">
            <Terminal className="h-6 w-6 stroke-1 text-zinc-700" />
            <p className="text-xs">
              {filter ? 'No log lines matching search query' : 'Awaiting deployment log stream...'}
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Terminal Footer Bar */}
      <div className="flex items-center justify-between border-t border-zinc-800/60 bg-[#0e0e11] px-4 py-1.5 text-[11px] text-zinc-500">
        <span>Total lines: {logs.length}</span>
        <span>ClickHouse Data Warehouse</span>
      </div>
    </div>
  );
}
