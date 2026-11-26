import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Globe,
  Rocket,
  Share2,
  Copy,
  Check,
  Clock,
  Layers,
  ChevronRight,
  ExternalLink,
  GitCommit,
  AlertCircle
} from 'lucide-react';
import GithubIcon from '../components/GithubIcon';
import StatusBadge from '../components/StatusBadge';
import PreviewFrame from '../components/PreviewFrame';
import {
  isDeploymentActive,
  canTransitionStatus,
} from '../api';
import { useApi } from '../hooks/useApi';
import { subscribeToDeploymentStatus } from '../socket';
import { getAppUrl } from '../config';

export default function Project() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = async (silent = false) => {
    const isSilent = silent === true;
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      const data = await api.fetchProject(id);
      setProject(data);
    } catch (err) {
      if (!isSilent) setError(err.message || 'Failed to load project');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Real-time status updates via Socket.io
  useEffect(() => {
    const unsubscribe = subscribeToDeploymentStatus(({ deploymentId, project: slug, projectId, status }) => {
      setProject((prev) => {
        if (!prev) return prev;
        const deps = prev.Deployment || [];
        const matchesProject =
          (projectId && prev.id === projectId) ||
          (slug && prev.subDomain === slug) ||
          deps.some((d) => d.id === deploymentId);
        if (!matchesProject) return prev;

        const hasDep = deps.some((d) => d.id === deploymentId);
        if (!hasDep) {
          api.fetchProject(id).then((fresh) => fresh && setProject(fresh)).catch(() => {});
          return prev;
        }

        return {
          ...prev,
          Deployment: deps.map((d) =>
            d.id === deploymentId && canTransitionStatus(d.status, status)
              ? { ...d, status }
              : d
          ),
        };
      });
    });

    return unsubscribe;
  }, [id]);

  // Conditional polling while any deployment for this project is still queued or building
  const hasActiveDeployment = (project?.Deployment || []).some((d) => isDeploymentActive(d.status));
  useEffect(() => {
    if (!hasActiveDeployment) return;
    const timer = setInterval(() => {
      loadData(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [id, hasActiveDeployment]);

  const handleDeploy = async () => {
    if (!project) return;
    try {
      setDeploying(true);
      const res = await api.triggerDeploy(project.id);
      if (res?.deploymentId) {
        navigate(`/deployment/${res.deploymentId}`);
      } else {
        await loadData();
      }
    } catch (err) {
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !project) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500 font-mono text-xs">
        Loading project details...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-xl border border-rose-950/50 bg-rose-950/20 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-rose-300">{error || 'Project not found'}</h3>
        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const deployments = project.Deployment || [];
  const latestDeployment = deployments[0];
  const appUrl = getAppUrl(project.subDomain);

  return (
    <div className="space-y-8">
      {/* Back Link & Navigation */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All Projects
        </Link>
      </div>

      {/* Project Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">{project.name}</h1>
            <StatusBadge status={latestDeployment?.status || 'NOT_STARTED'} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 mt-2 font-mono">
            <a
              href={project.gitURL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <GithubIcon className="h-3.5 w-3.5 text-zinc-500" />
              <span>{project.gitURL.replace(/^https?:\/\/github\.com\//, '')}</span>
            </a>

            <span className="text-zinc-700">•</span>

            <div className="flex items-center gap-1 text-zinc-400">
              <Globe className="h-3.5 w-3.5 text-zinc-500" />
              <span>{project.subDomain}</span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5">
          <a
            href={appUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Globe className="h-3.5 w-3.5 text-emerald-400" />
            Visit Website
          </a>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Share Project URL"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Rocket className="h-3.5 w-3.5" />
            {deploying ? 'Triggering...' : 'Deploy Now'}
          </button>
        </div>
      </div>

      {/* Website Live Preview Frame */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300 tracking-tight">Website Preview</h2>
        <PreviewFrame url={appUrl} subDomain={project.subDomain} />
      </section>

      {/* Deployments History List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300 tracking-tight">
            Deployments ({deployments.length})
          </h2>
          <span className="text-xs text-zinc-500 font-mono">Sorted chronologically</span>
        </div>

        {deployments.length > 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-[#101014] overflow-hidden divide-y divide-zinc-800/60 font-mono text-xs">
            {deployments.map((dep, index) => {
              // Sequential deployment number: total - index
              const deploymentNumber = deployments.length - index;

              return (
                <div
                  key={dep.id}
                  onClick={() => navigate(`/deployment/${dep.id}`)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-zinc-900/60 transition-colors cursor-pointer gap-3 group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-500 font-bold shrink-0 w-24">
                      Deploy #{deploymentNumber}
                    </span>

                    <StatusBadge status={dep.status} />

                    <div className="flex items-center gap-1.5 text-zinc-400 truncate max-w-xs text-[11px]">
                      <GitCommit className="h-3.5 w-3.5 text-zinc-600" />
                      <span className="text-zinc-500">commit:</span>
                      <span className="text-zinc-400">main @ HEAD</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-zinc-500 text-[11px] justify-between sm:justify-end">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(dep.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="flex items-center gap-1 text-zinc-400 group-hover:text-white transition-colors">
                      <span>View Logs</span>
                      <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500 text-xs font-mono">
            No deployments recorded yet. Click "Deploy Now" to launch your first build.
          </div>
        )}
      </section>
    </div>
  );
}
