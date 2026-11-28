import { CONFIG } from './config';

const BASE = CONFIG.API_BASE_URL;

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractErrorMessage(data, fallback) {
  if (!data) return fallback;
  return data.error?.[0]?.message || data.message || data.error || fallback;
}

/**
 * Creates an authenticated API client that attaches Clerk session Bearer JWTs.
 */
export function createApiClient(getToken) {
  async function authFetch(path, options = {}) {
    const token = typeof getToken === 'function' ? await getToken() : null;
    return fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  return {
    async fetchProjects() {
      const res = await authFetch('/projects');
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, `Failed to fetch projects (${res.status})`));
      }
      return data?.data?.projects || [];
    },

    async fetchProject(id) {
      const res = await authFetch(`/project/${id}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, `Failed to fetch project (${res.status})`));
      }
      return data?.data?.project || null;
    },

    async createProject({ name, gitURL, subDomain }) {
      const res = await authFetch('/project', {
        method: 'POST',
        body: JSON.stringify({ name, gitURL, subDomain }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        const errorMsg = extractErrorMessage(data, 'Failed to create project');
        const err = new Error(errorMsg);
        err.status = res.status;
        err.field = data?.field || null;
        err.existingProject = data?.data?.existingProject || null;
        throw err;
      }
      return data?.data?.project;
    },

    async generateSubdomain() {
      const res = await authFetch('/slug/generate');
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, 'Failed to generate subdomain'));
      }
      return data?.data?.subDomain || '';
    },

    async triggerDeploy(projectId) {
      const res = await authFetch('/deploy', {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, 'Failed to trigger deployment'));
      }
      return data?.data;
    },

    async fetchDeployment(id) {
      const res = await authFetch(`/deployment/${id}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, `Failed to fetch deployment (${res.status})`));
      }
      return data?.data?.deployment || null;
    },

    async fetchDeploymentLogs(deploymentId, limit = 1500) {
      const res = await authFetch(`/logs/${deploymentId}?limit=${limit}`);
      if (!res.ok) {
        // If ClickHouse endpoint is inactive or forbidden, fail gracefully with empty list
        return [];
      }
      const data = await parseJsonSafe(res);
      return data?.logs || [];
    },
  };
}

const defaultClient = createApiClient();

export const fetchProjects = (getToken) =>
  (getToken ? createApiClient(getToken) : defaultClient).fetchProjects();

export const fetchProject = (id, getToken) =>
  (getToken ? createApiClient(getToken) : defaultClient).fetchProject(id);

export const createProject = (payload, getToken) =>
  (getToken ? createApiClient(getToken) : defaultClient).createProject(payload);

export const generateSubdomain = (getToken) =>
  (getToken ? createApiClient(getToken) : defaultClient).generateSubdomain();

export const triggerDeploy = (projectId, getToken) =>
  (getToken ? createApiClient(getToken) : defaultClient).triggerDeploy(projectId);

export const fetchDeployment = (id, getToken) =>
  (getToken ? createApiClient(getToken) : defaultClient).fetchDeployment(id);

export const fetchDeploymentLogs = (deploymentId, limit = 1500, getToken) =>
  (getToken ? createApiClient(getToken) : defaultClient).fetchDeploymentLogs(deploymentId, limit);

export const isDeploymentActive = (status) =>
  status === 'QUEUED' || status === 'IN_PROGRESS';

const STATUS_RANK = {
  NOT_STARTED: 0,
  QUEUED: 1,
  IN_PROGRESS: 2,
  READY: 3,
  FAIL: 3,
};

export const canTransitionStatus = (currentStatus, nextStatus) => {
  if (!nextStatus || !(nextStatus in STATUS_RANK)) return false;
  if (!currentStatus || !(currentStatus in STATUS_RANK)) return true;
  if (currentStatus === nextStatus) return false;
  return STATUS_RANK[nextStatus] > STATUS_RANK[currentStatus];
};
