export const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000',
  WS_URL: import.meta.env.VITE_WS_URL || 'http://localhost:9000',
  PROXY_PROTOCOL: import.meta.env.VITE_PROXY_PROTOCOL || 'http',
  PROXY_BASE_DOMAIN: import.meta.env.VITE_PROXY_BASE_DOMAIN || 'localhost:8000',
  CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '',
};

/**
 * Generates the full website URL hosted through the R2 Reverse Proxy.
 * Example: 'quick-fox' -> 'http://quick-fox.localhost:8000'
 */
export function getAppUrl(subDomain) {
  if (!subDomain) return '';
  return `${CONFIG.PROXY_PROTOCOL}://${subDomain}.${CONFIG.PROXY_BASE_DOMAIN}`;
}
