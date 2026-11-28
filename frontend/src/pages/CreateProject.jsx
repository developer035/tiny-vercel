import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Globe,
  RefreshCw,
  GitBranch,
  FolderTree,
  Terminal,
  Layers,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Sparkles,
} from 'lucide-react';
import GithubIcon from '../components/GithubIcon';
import EnvVarsEditor from '../components/EnvVarsEditor';
import { useApi } from '../hooks/useApi';

function deriveProjectName(gitUrl) {
  if (!gitUrl || typeof gitUrl !== 'string') return '';
  try {
    const parsed = new URL(gitUrl.trim());
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return segments[1].replace(/\.git$/i, '');
    }
  } catch {
    const match = gitUrl.trim().match(/github\.com\/[^/]+\/([^/]+?)(?:\.git)?$/i);
    if (match) return match[1];
  }
  return '';
}

export default function CreateProject() {
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();

  const stateData = location.state || {};
  const [gitURL, setGitURL] = useState(stateData.gitURL || '');
  const [name, setName] = useState(stateData.name || deriveProjectName(stateData.gitURL) || '');
  const [projectId, setProjectId] = useState(
    stateData.projectId || deriveProjectName(stateData.gitURL) || ''
  );
  const [subDomain, setSubDomain] = useState(stateData.subDomain || '');
  const [loadingSlug, setLoadingSlug] = useState(false);

  // Placeholders (UI only)
  const [branch, setBranch] = useState('main');
  const [rootDirectory, setRootDirectory] = useState('./');
  const [installCommand, setInstallCommand] = useState('npm install');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [outputDirectory, setOutputDirectory] = useState('dist');
  const [envs, setEnvs] = useState([
    { key: 'NODE_ENV', value: 'production' },
  ]);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [errorField, setErrorField] = useState(null);
  const [existingProject, setExistingProject] = useState(null);

  // Generate initial subdomain if not already provided
  useEffect(() => {
    if (!subDomain) {
      handleRegenerateSlug();
    }
  }, []);

  const handleRegenerateSlug = async () => {
    try {
      setLoadingSlug(true);
      const generated = await api.generateSubdomain();
      if (generated) {
        setSubDomain(generated);
      }
    } catch (err) {
      console.warn('Failed to generate subdomain slug:', err.message);
    } finally {
      setLoadingSlug(false);
    }
  };

  const handleGitUrlChange = (newUrl) => {
    setGitURL(newUrl);
    const derived = deriveProjectName(newUrl);
    if (derived) {
      if (!name || name === deriveProjectName(gitURL)) {
        setName(derived);
      }
      if (!projectId || projectId === deriveProjectName(gitURL)) {
        setProjectId(derived);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setErrorField(null);
    setExistingProject(null);

    const cleanName = name.trim();
    const cleanGitUrl = gitURL.trim();
    const cleanSubDomain = subDomain.trim().toLowerCase();

    if (!cleanName) {
      setFormError('Project name is required');
      setErrorField('name');
      return;
    }
    if (!cleanGitUrl) {
      setFormError('GitHub repository URL is required');
      setErrorField('gitURL');
      return;
    }

    try {
      setSubmitting(true);
      const project = await api.createProject({
        name: cleanName,
        gitURL: cleanGitUrl,
        subDomain: cleanSubDomain || undefined,
      });

      if (project?.id) {
        // Redirect directly to the project dashboard
        navigate(`/project/${project.id}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create project');
      setErrorField(err.field || null);
      if (err.existingProject) {
        setExistingProject(err.existingProject);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12 font-sans">
      {/* Back link */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-mono"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
        </Link>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Create a New Project
          </h1>
        </div>
        <p className="mt-1.5 text-xs text-zinc-400">
          Configure project identity, unique subdomain slug, and deployment settings.
        </p>
      </div>

      {formError && (
        <div className="rounded-xl border border-rose-950/60 bg-rose-950/20 p-4 text-xs text-rose-300 space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
          {existingProject && (
            <div className="pl-6">
              <Link
                to={`/project/${existingProject.id}`}
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2"
              >
                Open existing project &ldquo;{existingProject.name}&rdquo; &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Project Identity */}
        <div className="rounded-xl border border-zinc-800 bg-[#101013] p-5 shadow-lg space-y-5">
          <div className="border-b border-zinc-800/80 pb-3">
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Project Identity
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Core properties identifying your repository and web deployment.
            </p>
          </div>

          {/* GitHub Repo URL */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <GithubIcon className="h-3.5 w-3.5 text-zinc-400" />
                GitHub Repository URL
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">Unique per user</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://github.com/username/repository"
              value={gitURL}
              onChange={(e) => handleGitUrlChange(e.target.value)}
              className={`w-full rounded-lg border bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none transition-colors ${
                errorField === 'gitURL'
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-zinc-800 focus:border-zinc-600'
              }`}
            />
          </div>

          {/* Project Name and User Project ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Project Name</span>
                <span className="text-[11px] text-zinc-500 font-mono">Unique per user</span>
              </label>
              <input
                type="text"
                required
                placeholder="my-awesome-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full rounded-lg border bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none transition-colors ${
                  errorField === 'name'
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-zinc-800 focus:border-zinc-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Project ID</span>
                <span className="text-[11px] text-zinc-500 font-mono">Custom identifier</span>
              </label>
              <input
                type="text"
                placeholder="project-identifier"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
          </div>

          {/* Subdomain slug with Regenerate Button */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-zinc-400" />
                Subdomain Slug
              </span>
              <span className="text-[11px] text-emerald-400/90 font-mono">
                Globally unique across all users
              </span>
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  placeholder="slug-name"
                  value={subDomain}
                  onChange={(e) =>
                    setSubDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                  }
                  className={`w-full rounded-lg border bg-zinc-950 pl-3.5 pr-28 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none transition-colors ${
                    errorField === 'subDomain'
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-zinc-800 focus:border-zinc-600'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-500 pointer-events-none select-none">
                  .localhost:8000
                </span>
              </div>

              <button
                type="button"
                onClick={handleRegenerateSlug}
                disabled={loadingSlug}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50 shrink-0"
                title="Regenerate unique slug"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingSlug ? 'animate-spin text-cyan-400' : ''}`} />
                <span>Regenerate Slug</span>
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Live website address: <span className="font-mono text-zinc-400">http://{subDomain || '...'}.localhost:8000</span>
            </p>
          </div>
        </div>

        {/* Card 2: Build & Source Configuration (Placeholders) */}
        <div className="rounded-xl border border-zinc-800 bg-[#101013] p-5 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <Sliders className="h-4 w-4 text-zinc-400" />
                Build & Deployment Settings
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Branch routing, sub-directory workspace, and build commands.
              </p>
            </div>
            <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              Placeholder • UI Preview Only
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-zinc-500" />
                Production Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <FolderTree className="h-3.5 w-3.5 text-zinc-500" />
                Root Directory / Sub-folder
              </label>
              <input
                type="text"
                value={rootDirectory}
                onChange={(e) => setRootDirectory(e.target.value)}
                placeholder="./"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                Install Command
              </label>
              <input
                type="text"
                value={installCommand}
                onChange={(e) => setInstallCommand(e.target.value)}
                placeholder="npm install"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                Build Command
              </label>
              <input
                type="text"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="npm run build"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-zinc-500" />
                Output Directory
              </label>
              <input
                type="text"
                value={outputDirectory}
                onChange={(e) => setOutputDirectory(e.target.value)}
                placeholder="dist"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Environment Variables (Placeholder) */}
        <div className="rounded-xl border border-zinc-800 bg-[#101013] p-5 shadow-lg">
          <EnvVarsEditor
            envs={envs}
            onChange={setEnvs}
            badge="Placeholder Only • No Backend Persistence"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/"
            className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Creating Project...</span>
              </>
            ) : (
              <span>Create Project</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
