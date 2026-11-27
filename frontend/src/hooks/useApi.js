import { useMemo, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { createApiClient } from '../api';

/**
 * Returns a stable, auth-aware API client that attaches Clerk JWTs to each request.
 */
export function useApi() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  return useMemo(
    () => createApiClient(() => getTokenRef.current?.()),
    []
  );
}
