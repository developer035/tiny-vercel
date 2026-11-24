import React from 'react';
import AnsiText from './AnsiText';

const STAGE_STYLES = {
  provisioning: { label: '[PROVISION]', cls: 'text-fuchsia-400 bg-fuchsia-950/40 border-fuchsia-800/40' },
  container:    { label: '[CONTAINER]', cls: 'text-blue-400 bg-blue-950/40 border-blue-800/40' },
  source:       { label: '[SOURCE]   ', cls: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/40' },
  environment:  { label: '[ENV]      ', cls: 'text-amber-400 bg-amber-950/40 border-amber-800/40' },
  install:      { label: '[INSTALL]  ', cls: 'text-sky-400 bg-sky-950/40 border-sky-800/40' },
  build:        { label: '[BUILD]    ', cls: 'text-purple-400 bg-purple-950/40 border-purple-800/40' },
  upload:       { label: '[UPLOAD]   ', cls: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/40' },
  ready:        { label: '[READY]    ', cls: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' },
  error:        { label: '[ERROR]    ', cls: 'text-rose-400 bg-rose-950/40 border-rose-800/40' },
};

const LEVEL_STYLES = {
  ready:   { badge: '✔ READY', cls: 'text-emerald-400 font-semibold' },
  success: { badge: '✔ READY', cls: 'text-emerald-400 font-semibold' },
  upload:  { badge: '☁ UPLOAD', cls: 'text-yellow-400' },
  step:    { badge: 'ℹ STEP ', cls: 'text-cyan-400 font-semibold' },
  warn:    { badge: '⚠ WARN ', cls: 'text-amber-400 font-semibold' },
  error:   { badge: '✖ ERROR', cls: 'text-rose-400 font-semibold' },
  cmd:     { badge: '⚡ CMD  ', cls: 'text-fuchsia-400 font-semibold' },
  stdout:  { badge: '• OUT  ', cls: 'text-zinc-500' },
  stderr:  { badge: '• ERR  ', cls: 'text-amber-300' },
  info:    { badge: '• INFO ', cls: 'text-zinc-400' },
};

export default function TerminalLine({ logEntry }) {
  const { timestamp, stage, level, log } = logEntry;

  const timeStr = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-GB')
    : new Date().toLocaleTimeString('en-GB');

  const normalizedStage = (stage || 'build').toLowerCase();
  const stageInfo = STAGE_STYLES[normalizedStage] || {
    label: `[${normalizedStage.slice(0, 9).toUpperCase()}]`,
    cls: 'text-zinc-400 bg-zinc-900 border-zinc-800',
  };

  const normalizedLevel = (level || 'info').toLowerCase();
  const levelInfo = LEVEL_STYLES[normalizedLevel] || LEVEL_STYLES.info;

  return (
    <div className="flex items-start gap-2 py-0.5 px-2 hover:bg-zinc-900/60 transition-colors font-mono text-[12px] leading-relaxed group">
      {/* Time column */}
      <span className="text-zinc-600 select-none shrink-0 w-16 text-right">
        {timeStr}
      </span>

      <span className="text-zinc-800 select-none shrink-0">│</span>

      {/* Stage Badge */}
      <span
        className={`px-1.5 py-0.2 rounded text-[10px] font-semibold tracking-tight border shrink-0 ${stageInfo.cls}`}
      >
        {stageInfo.label}
      </span>

      <span className="text-zinc-800 select-none shrink-0">│</span>

      {/* Level Badge */}
      <span className={`shrink-0 w-16 text-[11px] ${levelInfo.cls}`}>
        {levelInfo.badge}
      </span>

      <span className="text-zinc-800 select-none shrink-0">│</span>

      {/* Log Content */}
      <div className="flex-1 text-zinc-300 min-w-0">
        <AnsiText text={log} />
      </div>
    </div>
  );
}
