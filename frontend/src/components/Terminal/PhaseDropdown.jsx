import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Circle,
} from 'lucide-react';
import TerminalLine from './TerminalLine';

function PhaseStatusIcon({ status }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-label="Success" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-rose-400 shrink-0" aria-label="Failed" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-cyan-400 animate-spin shrink-0" aria-label="Running" />;
    case 'skipped':
      return <Circle className="h-3.5 w-3.5 text-zinc-700 shrink-0" aria-label="Skipped" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-zinc-600 shrink-0" aria-label="Pending" />;
  }
}

export default function PhaseDropdown({
  phase,
  visibleLogs,
  isExpanded,
  onToggle,
  isFiltered = false,
}) {
  const { key, title, stepLabel, description, status, logs, warningCount, durationLabel } = phase;
  const hasWarnings = warningCount > 0;

  let containerBorder = 'border-zinc-800/90';
  let headerBg = 'bg-[#101014] hover:bg-zinc-900/70';

  if (status === 'failed') {
    containerBorder = 'border-rose-500/35';
    headerBg = 'bg-rose-950/15 hover:bg-rose-950/25';
  } else if (status === 'running') {
    containerBorder = 'border-cyan-500/35';
    headerBg = 'bg-cyan-950/10 hover:bg-cyan-950/20';
  } else if (hasWarnings && status === 'success') {
    containerBorder = 'border-amber-500/25';
    headerBg = 'bg-[#111114] hover:bg-zinc-900/70';
  }

  const isDimmed = status === 'pending' || status === 'skipped';

  const statusMetaText =
    status === 'running'
      ? 'Running'
      : status === 'failed'
        ? 'Failed'
        : status === 'skipped'
          ? 'Skipped'
          : status === 'pending'
            ? 'Waiting'
            : null;

  const emptyMessage = (() => {
    if (isFiltered && logs.length > 0) {
      return 'No log lines in this phase match the active filter.';
    }
    if (key === 'provisioning' && status === 'success') {
      return 'Provisioning completed and handed off to build container (live dispatch logs are not persisted to ClickHouse).';
    }
    if (status === 'skipped') {
      return 'Phase skipped because an earlier phase failed.';
    }
    if (status === 'pending') {
      return `Waiting to reach ${title.toLowerCase()}...`;
    }
    if (status === 'running') {
      return 'Phase started, awaiting log output...';
    }
    return 'No log lines recorded for this phase.';
  })();

  return (
    <div className={`rounded-lg border ${containerBorder} overflow-hidden transition-colors`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={`w-full flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors ${headerBg}`}
      >
        {/* Left: Chevron, Status Symbol, Title, Step Pill, Warning Symbol */}
        <div className="flex items-center gap-2.5 min-w-0">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          )}

          <PhaseStatusIcon status={status} />

          <span
            className={`font-sans text-xs font-semibold tracking-tight truncate ${
              isDimmed ? 'text-zinc-500' : 'text-zinc-100'
            }`}
          >
            {title}
          </span>

          <span className="hidden sm:inline-block rounded border border-zinc-800 bg-zinc-950/70 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 shrink-0">
            {stepLabel}
          </span>

          {hasWarnings && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-300 shrink-0"
              title={`${warningCount} npm / build warning${warningCount === 1 ? '' : 's'} detected`}
            >
              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
              <span>
                {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
              </span>
            </span>
          )}
        </div>

        {/* Right: Status Tag, Duration, Line Count */}
        <div className="flex items-center gap-2.5 text-[11px] font-mono shrink-0 ml-auto">
          {statusMetaText && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                status === 'running'
                  ? 'text-cyan-300 bg-cyan-950/40 border border-cyan-800/40'
                  : status === 'failed'
                    ? 'text-rose-300 bg-rose-950/40 border border-rose-800/40'
                    : 'text-zinc-500'
              }`}
            >
              {statusMetaText}
            </span>
          )}

          {durationLabel && (
            <span className="text-zinc-400">{durationLabel}</span>
          )}

          <span className="text-zinc-500">
            {isFiltered && logs.length > 0
              ? `${visibleLogs.length}/${logs.length} lines`
              : `${logs.length} ${logs.length === 1 ? 'line' : 'lines'}`}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-800/80 bg-[#060608]">
          {visibleLogs.length > 0 ? (
            <div className="divide-y divide-zinc-900/40 py-1">
              {visibleLogs.map((logItem, idx) => (
                <TerminalLine
                  key={logItem.event_id || `${key}-${idx}-${logItem.timestamp || ''}`}
                  logEntry={logItem}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-[11px] text-zinc-500 flex items-center justify-between gap-3">
              <span>{emptyMessage}</span>
              <span className="hidden md:inline text-zinc-600">{description}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
