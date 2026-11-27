import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Globe, Shield, Terminal as TerminalIcon, AlertCircle, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import TerminalViewer from '../components/Terminal/TerminalViewer';
import {
  isDeploymentActive,
  canTransitionStatus,
} from '../api';
import { useApi } from '../hooks/useApi';
import { subscribeToLogs, subscribeToDeploymentStatus } from '../socket';
import { getAppUrl } from '../config';

export default function Deployment() {
  const { deploymentId } = useParams();
  const api = useApi();

  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    let unsubscribeSocket = null;
    let unsubscribeStatus = null;

    const getLogKey = (item) => {
      if (!item) return '';
      if (item.event_id) return item.event_id;
      return `${item.timestamp || ''}|${item.stage || ''}|${item.level || ''}|${item.log || ''}`;
    };

    const applyStatusTransition = (nextStatus) => {
      setDeployment((prev) => {
        if (!prev || !canTransitionStatus(prev.status, nextStatus)) return prev;
        return { ...prev, status: nextStatus };
      });
    };

    const loadDeploymentAndLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch deployment record
        const depData = await api.fetchDeployment(deploymentId);
        if (isCancelled) return;
        setDeployment(depData);

        // 2. Fetch historical logs from ClickHouse
        const clickhouseLogs = await api.fetchDeploymentLogs(deploymentId);
        if (isCancelled) return;
        setLogs(clickhouseLogs || []);

        // 3. Listen for real-time backend status transitions for this deployment
        unsubscribeStatus = subscribeToDeploymentStatus(({ deploymentId: evtDepId, status }) => {
          if (isCancelled || evtDepId !== deploymentId) return;
          applyStatusTransition(status);
        });

        // 4. Connect real-time WebSocket subscriber if project subdomain is available
        const projectSlug = depData?.project?.subDomain;
        if (projectSlug && !isCancelled) {
          unsubscribeSocket = subscribeToLogs(projectSlug, (incomingLog) => {
            if (isCancelled) return;
            // Ignore Kafka logs belonging to a different deployment of the same project
            if (incomingLog.deployment_id && incomingLog.deployment_id !== deploymentId) {
              return;
            }

            // Deduplicate incoming log lines
            setLogs((prev) => {
              const incomingKey = getLogKey(incomingLog);
              const exists = prev.some((l) => getLogKey(l) === incomingKey);
              if (exists) return prev;
              return [...prev, incomingLog];
            });

            // Sync UI status when active or terminal log stages arrive
            if (incomingLog.level === 'ready' || incomingLog.stage === 'ready') {
              applyStatusTransition('READY');
            } else if (incomingLog.stage === 'error') {
              applyStatusTransition('FAIL');
            } else if (
              ['container', 'source', 'environment', 'install', 'build', 'upload'].includes(incomingLog.stage)
            ) {
              applyStatusTransition('IN_PROGRESS');
            }
          });
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load deployment');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadDeploymentAndLogs();

    return () => {
      isCancelled = true;
      if (unsubscribeSocket) unsubscribeSocket();
      if (unsubscribeStatus) unsubscribeStatus();
    };
  }, [deploymentId]);

  // Lightweight polling fallback while deployment is active in case a WebSocket frame was missed
  useEffect(() => {
    if (!isDeploymentActive(deployment?.status)) return;

    const timer = setInterval(() => {
      api.fetchDeployment(deploymentId)
        .then((updated) => {
          if (updated) setDeployment(updated);
        })
        .catch(() => {});
    }, 4000);

    return () => clearInterval(timer);
  }, [deploymentId, deployment?.status]);

  if (loading && !deployment) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500 font-mono text-xs">
        Loading deployment & logs...
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className="rounded-xl border border-rose-950/50 bg-rose-950/20 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-rose-300">{error || 'Deployment not found'}</h3>
        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const project = deployment.project;
  const isLive = isDeploymentActive(deployment.status);
  const appUrl = getAppUrl(project?.subDomain);

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to={`/project/${project?.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {project?.name || 'Project'}
        </Link>
      </div>

      {/* Deployment Information Cards */}
      <div className="rounded-xl border border-zinc-800 bg-[#101014] p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Deployment <span className="font-mono text-zinc-400 font-normal">#{deployment.id.slice(0, 8)}</span>
              </h1>
              <StatusBadge status={deployment.status} />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 mt-2 font-mono">
              <span className="text-zinc-500">Project:</span>
              <span className="text-zinc-200 font-semibold">{project?.name}</span>

              <span className="text-zinc-700">•</span>

              <span className="text-zinc-500">Domain:</span>
              <a
                href={appUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>{project?.subDomain}</span>
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>Created: {new Date(deployment.createdAt).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* High-Fidelity Terminal Log Box */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-200 tracking-tight">
              Build & Container Execution Logs
            </h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            Stream: Kafka → ClickHouse → Socket.io
          </span>
        </div>

        <TerminalViewer
          logs={logs}
          isLive={isLive}
          deploymentId={deployment.id}
          deploymentStatus={deployment.status}
        />
      </section>
    </div>
  );
}
