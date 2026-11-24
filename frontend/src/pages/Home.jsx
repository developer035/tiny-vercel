import React, { useState, useEffect } from 'react';
import { Plus, FolderGit2, Search, RefreshCw, AlertCircle } from 'lucide-react';
import ProjectCard from '../components/ProjectCard';
import Modal from '../components/Modal';
import { fetchProjects, createProject } from '../api';

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  // New project form state
  const [name, setName] = useState('');
  const [gitURL, setGitURL] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Project name is required');
      return;
    }
    if (!gitURL.trim()) {
      setFormError('GitHub repository URL is required');
      return;
    }

    try {
      setSubmitting(true);
      await createProject({ name: name.trim(), gitURL: gitURL.trim() });
      setName('');
      setGitURL('');
      setIsModalOpen(false);
      await loadProjects();
    } catch (err) {
      setFormError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.gitURL.toLowerCase().includes(search.toLowerCase()) ||
    p.subDomain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Projects</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your Git repositories, view deployments, and monitor builds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadProjects}
            className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Refresh projects"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Search projects by name, repo, or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-[#121215] pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
        />
      </div>

      {/* Projects Grid */}
      {error && (
        <div className="rounded-lg border border-rose-950/50 bg-rose-950/20 p-4 flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && projects.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
            />
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center flex flex-col items-center justify-center">
          <FolderGit2 className="h-10 w-10 text-zinc-600 mb-3" />
          <h3 className="text-sm font-semibold text-zinc-300">No projects found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            {search
              ? 'No projects match your search query.'
              : 'Create your first project by linking a public GitHub repository.'}
          </p>
          {!search && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Project
            </button>
          )}
        </div>
      )}

      {/* New Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Deploy New Project"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          {formError && (
            <div className="rounded-md border border-rose-900/50 bg-rose-950/30 p-2.5 text-xs text-rose-400">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Project Name
            </label>
            <input
              type="text"
              placeholder="e.g. my-vite-app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              GitHub Repository URL
            </label>
            <input
              type="url"
              placeholder="https://github.com/username/repository"
              value={gitURL}
              onChange={(e) => setGitURL(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors font-mono"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Tiny Vercel supports Vite, React, Vue, Svelte, Next static, and standard static web projects.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create & Deploy'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
