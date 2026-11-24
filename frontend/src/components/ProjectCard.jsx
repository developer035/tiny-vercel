import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Globe, Copy, Check, Clock, Layers } from 'lucide-react';
import GithubIcon from './GithubIcon';
import StatusBadge from './StatusBadge';
import { getAppUrl } from '../config';

export default function ProjectCard({ project }) {
  const [copied, setCopied] = useState(false);

  const deployments = project.Deployment || [];
  const latestDeployment = deployments[0]; // sorted desc by backend
  const appUrl = getAppUrl(project.subDomain);

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Link
      to={`/project/${project.id}`}
      className="group block rounded-xl border border-zinc-800 bg-[#111113] p-5 hover:border-zinc-700 hover:bg-[#141418] transition-all duration-200 shadow-md hover:shadow-xl hover:translate-y-[-1px]"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold text-zinc-100 group-hover:text-white transition-colors truncate">
          {project.name}
        </h3>
        <StatusBadge status={latestDeployment?.status || 'NOT_STARTED'} />
      </div>

      {/* GitHub Repository link */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-4 truncate">
        <GithubIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
        <span className="truncate hover:text-zinc-200 transition-colors">
          {project.gitURL.replace(/^https?:\/\/github\.com\//, '')}
        </span>
      </div>

      {/* Subdomain & Link section */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-xs">
        <div className="flex items-center gap-1.5 font-mono text-zinc-400 text-[11px] truncate max-w-[200px]">
          <Globe className="h-3 w-3 text-zinc-500 shrink-0" />
          <span className="truncate">{project.subDomain}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Copy Website URL"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={appUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Visit Website"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Footer info: stack & relative time */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          <span>Node.js / Vite</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{timeAgo(project.updatedAt || project.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
