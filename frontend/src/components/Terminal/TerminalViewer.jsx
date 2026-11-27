import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Terminal,
  Copy,
  Check,
  ArrowDown,
  Search,
  Download,
  ChevronsUpDown,
  ChevronsDownUp,
  Layers,
  List,
  AlertTriangle,
} from 'lucide-react';
import TerminalLine from './TerminalLine';
import PhaseDropdown from './PhaseDropdown';
import {
  DEPLOYMENT_PHASES,
  groupLogsIntoPhases,
  isWarningLog,
  isErrorLog,
  stripAnsi,
} from '../../utils/deploymentPhases';

const CATEGORY_FILTERS = ['all', 'warnings', 'errors', 'cmd', 'steps'];

export default function TerminalViewer({
  logs = [],
  isLive = false,
  deploymentId = '',
  deploymentStatus = '',
}) {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState('phases'); // 'phases' | 'raw'
  const [manualToggles, setManualToggles] = useState({});

  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const prevLogCountRef = useRef(0);

  // Reset manual accordion overrides when switching deployments or changing search/filter
  useEffect(() => {
    setManualToggles({});
    prevLogCountRef.current = 0;
  }, [deploymentId]);

  useEffect(() => {
    setManualToggles({});
  }, [filter, categoryFilter]);

  const phases = useMemo(
    () => groupLogsIntoPhases(logs, deploymentStatus),
    [logs, deploymentStatus]
  );

  const totalWarnings = useMemo(
    () => phases.reduce((sum, p) => sum + p.warningCount, 0),
    [phases]
  );

  // Auto-scroll only when new log lines arrive and Follow is enabled
  useEffect(() => {
    const prevCount = prevLogCountRef.current;
    prevLogCountRef.current = logs.length;
    if (autoScroll && logs.length > prevCount && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, autoScroll]);

  const matchesActiveFilters = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return (item) => {
      if (query) {
        const logText = stripAnsi(String(item.log || '')).toLowerCase();
        const stageText = String(item.stage || '').toLowerCase();
        if (!logText.includes(query) && !stageText.includes(query)) {
          return false;
        }
      }

      if (categoryFilter === 'warnings') {
        return isWarningLog(item) && !isErrorLog(item);
      }
      if (categoryFilter === 'errors') {
        return isErrorLog(item);
      }
      if (categoryFilter === 'cmd') {
        return item.level === 'cmd';
      }
      if (categoryFilter === 'steps') {
        return item.level === 'step' || item.level === 'ready';
      }
      return true;
    };
  }, [filter, categoryFilter]);

  const isFiltered = Boolean(filter.trim()) || categoryFilter !== 'all';
  const filteredRawLogs = useMemo(
    () => logs.filter(matchesActiveFilters),
    [logs, matchesActiveFilters]
  );

  const phaseVisibleLogsMap = useMemo(() => {
    const map = {};
    for (const phase of phases) {
      map[phase.key] = isFiltered ? phase.logs.filter(matchesActiveFilters) : phase.logs;
    }
    return map;
  }, [phases, isFiltered, matchesActiveFilters]);

  const isPhaseExpanded = (phase) => {
    if (phase.key in manualToggles) {
      return manualToggles[phase.key];
    }
    if (isFiltered && phaseVisibleLogsMap[phase.key]?.length > 0) {
      return true;
    }
    if (phase.status === 'running' || phase.status === 'failed') {
      return true;
    }
    if (phase.status === 'success' && phase.warningCount > 0) {
      return true;
    }
    return false;
  };

  const anyPhaseExpanded = phases.some((p) => isPhaseExpanded(p));

  const handleTogglePhase = (phase) => {
    const currentlyOpen = isPhaseExpanded(phase);
    setManualToggles((prev) => ({
      ...prev,
      [phase.key]: !currentlyOpen,
    }));
  };

  const handleToggleAllPhases = () => {
    const nextOpen = !anyPhaseExpanded;
    const next = {};
    for (const def of DEPLOYMENT_PHASES) {
      next[def.key] = nextOpen;
    }
    setManualToggles(next);
  };

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

  const completedCount = phases.filter((p) => p.status === 'success').length;
  const failedPhase = phases.find((p) => p.status === 'failed');

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

        {/* Center: Search & Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-950/80 pl-7 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 w-36 sm:w-44 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="hidden sm:flex items-center gap-1 border border-zinc-800 rounded-md p-0.5 bg-zinc-950/60">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors inline-flex items-center gap-1 ${
                  categoryFilter === cat
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>{cat}</span>
                {cat === 'warnings' && totalWarnings > 0 && (
                  <span className="text-[10px] text-amber-400">{totalWarnings}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right: View Switch & Actions */}
        <div className="flex items-center gap-1.5">
          {/* Phases vs Raw view switcher */}
          <div className="flex items-center gap-0.5 border border-zinc-800 rounded-md p-0.5 bg-zinc-950/60">
            <button
              type="button"
              onClick={() => setViewMode('phases')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
                viewMode === 'phases'
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Group logs into deployment phases"
            >
              <Layers className="h-3 w-3" />
              <span className="hidden md:inline">Phases</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
                viewMode === 'raw'
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Flat chronological log stream"
            >
              <List className="h-3 w-3" />
              <span className="hidden md:inline">Raw</span>
            </button>
          </div>

          {viewMode === 'phases' && (
            <button
              type="button"
              onClick={handleToggleAllPhases}
              className="flex items-center gap-1 px-2 py-1 rounded border border-zinc-800 bg-transparent text-[11px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
              title={anyPhaseExpanded ? 'Collapse all phases' : 'Expand all phases'}
            >
              {anyPhaseExpanded ? (
                <ChevronsDownUp className="h-3 w-3" />
              ) : (
                <ChevronsUpDown className="h-3 w-3" />
              )}
              <span className="hidden lg:inline">
                {anyPhaseExpanded ? 'Collapse' : 'Expand'}
              </span>
            </button>
          )}

          {/* Auto scroll toggle */}
          <button
            type="button"
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
            type="button"
            onClick={handleCopyAll}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Copy All Logs"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Download Log File"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Viewport */}
      <div
        ref={containerRef}
        className="max-h-[640px] min-h-[380px] overflow-y-auto overflow-x-hidden p-3 bg-[#060608] select-text"
      >
        {viewMode === 'phases' ? (
          <div className="space-y-2">
            {phases.map((phase) => (
              <PhaseDropdown
                key={phase.key}
                phase={phase}
                visibleLogs={phaseVisibleLogsMap[phase.key] || []}
                isExpanded={isPhaseExpanded(phase)}
                onToggle={() => handleTogglePhase(phase)}
                isFiltered={isFiltered}
              />
            ))}
          </div>
        ) : filteredRawLogs.length > 0 ? (
          <div className="flex flex-col divide-y divide-zinc-900/40">
            {filteredRawLogs.map((logItem, idx) => (
              <TerminalLine
                key={logItem.event_id || `log-${idx}-${logItem.timestamp || Date.now()}`}
                logEntry={logItem}
              />
            ))}
          </div>
        ) : (
          <div className="h-72 flex flex-col items-center justify-center text-zinc-600 gap-2">
            <Terminal className="h-6 w-6 stroke-1 text-zinc-700" />
            <p className="text-xs">
              {isFiltered ? 'No log lines matching active filter' : 'Awaiting deployment log stream...'}
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Terminal Footer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/60 bg-[#0e0e11] px-4 py-1.5 text-[11px] text-zinc-500">
        <div className="flex items-center gap-3">
          <span>
            Phases: {completedCount}/{phases.length} completed
            {failedPhase ? ` (failed at ${failedPhase.title})` : ''}
          </span>
          {totalWarnings > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {totalWarnings} {totalWarnings === 1 ? 'warning' : 'warnings'}
            </span>
          )}
        </div>
        <span>Total lines: {logs.length} • ClickHouse Data Warehouse</span>
      </div>
    </div>
  );
}
