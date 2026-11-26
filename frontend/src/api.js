import { CONFIG } from './config';

const BASE = CONFIG.API_BASE_URL;

export async function fetchProjects() {
  const res = await fetch(`${BASE}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects (${res.status})`);
  const data = await res.json();
  return data.data?.projects || [];
}

export async function fetchProject(id) {
  const res = await fetch(`${BASE}/project/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch project (${res.status})`);
  const data = await res.json();
  return data.data?.project || null;
}

export async function createProject({ name, gitURL }) {
  const res = await fetch(`${BASE}/project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, gitURL }),
  });
  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.error?.[0]?.message || data.error || data.message || 'Failed to create project';
    const err = new Error(errorMsg);
    err.status = res.status;
    err.existingProject = data.data?.existingProject || null;
    throw err;
  }
  return data.data?.project;
}

export async function triggerDeploy(projectId) {
  const res = await fetch(`${BASE}/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to trigger deployment');
  }
  return data.data;
}

export async function fetchDeployment(id) {
  const res = await fetch(`${BASE}/deployment/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch deployment (${res.status})`);
  const data = await res.json();
  return data.data?.deployment || null;
}

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

export async function fetchDeploymentLogs(deploymentId, limit = 1500) {
  const res = await fetch(`${BASE}/logs/${deploymentId}?limit=${limit}`);
  if (!res.ok) {
    // If ClickHouse endpoint is inactive, fail gracefully with empty list
    return [];
  }
  const data = await res.json();
  return data.logs || [];
}
