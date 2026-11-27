const ANSI_REGEX = /\x1b\[[0-9;?]*[A-Za-z]/g;

export const DEPLOYMENT_PHASES = [
  {
    key: 'provisioning',
    title: 'Provisioning',
    stepLabel: 'Dispatch',
    description: 'Queueing deployment and dispatching Cloud Run build worker',
  },
  {
    key: 'container',
    title: 'Container Startup',
    stepLabel: 'Init',
    description: 'Initializing build container and runtime environment',
  },
  {
    key: 'source',
    title: 'Source Cloning',
    stepLabel: 'Step 1/5',
    description: 'Cloning Git repository and resolving HEAD commit',
  },
  {
    key: 'environment',
    title: 'Environment Setup',
    stepLabel: 'Step 2/5',
    description: 'Configuring Node.js runtime and package manager',
  },
  {
    key: 'install',
    title: 'Install Dependencies',
    stepLabel: 'Step 3/5',
    description: 'Installing project dependencies',
  },
  {
    key: 'build',
    title: 'Build',
    stepLabel: 'Step 4/5',
    description: 'Running production build and verifying output directory',
  },
  {
    key: 'upload',
    title: 'Upload Artifacts',
    stepLabel: 'Step 5/5',
    description: 'Uploading build artifacts to Cloudflare R2 storage',
  },
  {
    key: 'ready',
    title: 'Deployment Summary',
    stepLabel: 'Ready',
    description: 'Finalizing deployment URL and build summary',
  },
];

const PHASE_INDEX_BY_KEY = DEPLOYMENT_PHASES.reduce((acc, phase, index) => {
  acc[phase.key] = index;
  return acc;
}, {});

export function stripAnsi(text) {
  return typeof text === 'string' ? text.replace(ANSI_REGEX, '') : '';
}

/**
 * Normalizes both ISO timestamps (with Z/offset) and ClickHouse DateTime64 UTC strings
 * ('YYYY-MM-DD HH:MM:SS.mmm') into a valid Date instance.
 */
export function parseLogTimestamp(timestamp) {
  if (!timestamp) return null;
  const raw = String(timestamp).trim();
  if (!raw) return null;

  // ClickHouse DateTime64(3, 'UTC') returns 'YYYY-MM-DD HH:MM:SS.mmm' without Z
  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)
      ? `${raw.replace(' ', 'T')}Z`
      : raw;

  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

export function formatPhaseDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  const totalSec = durationMs / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);
  return `${mins}m ${secs}s`;
}

export function isWarningLog(entry) {
  if (!entry) return false;
  const level = String(entry.level || '').toLowerCase();
  if (level === 'warn') return true;

  const clean = stripAnsi(entry.log || '').trim();
  if (!clean) return false;

  // Match npm WARN / npm warn (v10+), yarn "warning ...", pnpm WARN, and explicit warn prefixes
  return (
    /\bnpm\s+warn\b/i.test(clean) ||
    /^(?:npm\s+)?warn(?:ing)?(?:\s*[:!-]|\s+\S)/i.test(clean) ||
    clean.startsWith('⚠')
  );
}

export function isFatalErrorLog(entry) {
  if (!entry) return false;
  const level = String(entry.level || '').toLowerCase();
  const stage = String(entry.stage || '').toLowerCase();
  return level === 'error' || stage === 'error';
}

export function isErrorLog(entry) {
  if (isFatalErrorLog(entry)) return true;
  const clean = stripAnsi(entry?.log || '').trim();
  return /\bnpm\s+(?:ERR!|error\b)/i.test(clean);
}

/**
 * Buckets raw deployment logs into ordered phases and infers live/historical
 * status ('pending' | 'running' | 'success' | 'failed' | 'skipped') and counts.
 */
export function groupLogsIntoPhases(logs = [], deploymentStatus = '') {
  const buckets = DEPLOYMENT_PHASES.map((def, index) => ({
    ...def,
    index,
    logs: [],
    warningCount: 0,
    errorCount: 0,
    hasFatalError: false,
    firstTimestampMs: null,
    lastTimestampMs: null,
  }));

  let highestReachedIndex = -1;
  let sawErrorStage = false;
  const unattributedErrorLogs = [];

  for (const entry of logs) {
    if (!entry) continue;
    const stage = String(entry.stage || 'build').toLowerCase();

    if (stage === 'error') {
      sawErrorStage = true;
      if (highestReachedIndex >= 0) {
        const target = buckets[highestReachedIndex];
        target.logs.push(entry);
        target.hasFatalError = true;
        target.errorCount += 1;
        const tsMs = parseLogTimestamp(entry.timestamp);
        if (tsMs !== null) {
          if (target.firstTimestampMs === null) target.firstTimestampMs = tsMs;
          target.lastTimestampMs = tsMs;
        }
      } else {
        unattributedErrorLogs.push(entry);
      }
      continue;
    }

    const mappedIndex =
      stage in PHASE_INDEX_BY_KEY
        ? PHASE_INDEX_BY_KEY[stage]
        : highestReachedIndex >= 0
          ? highestReachedIndex
          : PHASE_INDEX_BY_KEY.build;

    const bucket = buckets[mappedIndex];
    bucket.logs.push(entry);

    if (isFatalErrorLog(entry)) {
      bucket.hasFatalError = true;
    }
    if (isErrorLog(entry)) {
      bucket.errorCount += 1;
    } else if (isWarningLog(entry)) {
      bucket.warningCount += 1;
    }

    const tsMs = parseLogTimestamp(entry.timestamp);
    if (tsMs !== null) {
      if (bucket.firstTimestampMs === null) bucket.firstTimestampMs = tsMs;
      bucket.lastTimestampMs = tsMs;
    }

    if (mappedIndex > highestReachedIndex) {
      highestReachedIndex = mappedIndex;
    }
  }

  const normalizedStatus = String(deploymentStatus || '').toUpperCase();
  const hasReadyLogs = buckets[PHASE_INDEX_BY_KEY.ready].logs.length > 0;
  const isTerminalReady = normalizedStatus === 'READY' || (hasReadyLogs && normalizedStatus !== 'FAIL');
  const isTerminalFail =
    normalizedStatus === 'FAIL' ||
    sawErrorStage ||
    buckets.some((b) => b.hasFatalError);

  const failedBucketIndex = buckets.findIndex((b) => b.hasFatalError);
  const errorTargetIndex =
    failedBucketIndex >= 0
      ? failedBucketIndex
      : highestReachedIndex >= 0
        ? highestReachedIndex
        : 0;

  if (unattributedErrorLogs.length > 0) {
    const target = buckets[errorTargetIndex];
    for (const errEntry of unattributedErrorLogs) {
      target.logs.push(errEntry);
      target.hasFatalError = true;
      target.errorCount += 1;
      const tsMs = parseLogTimestamp(errEntry.timestamp);
      if (tsMs !== null) {
        if (target.firstTimestampMs === null) target.firstTimestampMs = tsMs;
        target.lastTimestampMs = tsMs;
      }
    }
  }

  return buckets.map((bucket, index) => {
    let status = 'pending';

    if (isTerminalReady && !isTerminalFail) {
      status = 'success';
    } else if (isTerminalFail) {
      if (index < errorTargetIndex) {
        status = 'success';
      } else if (index === errorTargetIndex) {
        status = 'failed';
      } else {
        status = 'skipped';
      }
    } else if (normalizedStatus === 'QUEUED' || normalizedStatus === 'IN_PROGRESS' || logs.length > 0) {
      const activeIndex = highestReachedIndex >= 0 ? highestReachedIndex : 0;
      if (index < activeIndex) {
        status = 'success';
      } else if (index === activeIndex) {
        status = 'running';
      } else {
        status = 'pending';
      }
    }

    // Compute phase duration using next reached phase's start time when available
    let endMs = bucket.lastTimestampMs;
    for (let j = index + 1; j < buckets.length; j++) {
      if (buckets[j].firstTimestampMs !== null) {
        if (endMs === null || buckets[j].firstTimestampMs >= endMs) {
          endMs = buckets[j].firstTimestampMs;
        }
        break;
      }
    }

    const durationMs =
      bucket.firstTimestampMs !== null && endMs !== null && endMs > bucket.firstTimestampMs
        ? endMs - bucket.firstTimestampMs
        : null;

    return {
      key: bucket.key,
      index: bucket.index,
      title: bucket.title,
      stepLabel: bucket.stepLabel,
      description: bucket.description,
      status,
      logs: bucket.logs,
      warningCount: bucket.warningCount,
      errorCount: bucket.errorCount,
      durationMs,
      durationLabel: formatPhaseDuration(durationMs),
    };
  });
}
