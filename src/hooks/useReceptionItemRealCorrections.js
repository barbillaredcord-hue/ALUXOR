import { useCallback, useEffect, useRef, useState } from 'react';
import { ReceptionItemRealCorrectionRepository } from '../lib/receptions/receptionItemRealCorrectionRepository.js';
import { sortReceptionItemCorrections } from '../lib/receptions/receptionItemRealCorrectionProjection.js';

export function reconcileReceptionItemRealCorrectionEvent(current = [], incoming, workspaceId) {
  if (!incoming || incoming.workspaceId !== workspaceId) return current;
  const existing = current.find((item) => item.id === incoming.id);
  if (existing && Number(existing.version) >= Number(incoming.version)) return current;
  return sortReceptionItemCorrections([
    ...current.filter((item) => item.id !== incoming.id),
    incoming,
  ]);
}

export default function useReceptionItemRealCorrections({
  workspaceId,
  repository = ReceptionItemRealCorrectionRepository,
} = {}) {
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const generationRef = useRef(0);

  const merge = useCallback((incoming) => {
    setCorrections((current) => reconcileReceptionItemRealCorrectionEvent(
      current, incoming, workspaceId,
    ));
  }, [workspaceId]);

  const remove = useCallback((incoming) => {
    setCorrections((current) => current.filter((item) => item.id !== incoming?.id));
  }, []);

  const refresh = useCallback(async () => {
    if (!workspaceId) return { data: [], error: null };
    const generation = generationRef.current;
    setLoading(true);
    const result = await repository.listByWorkspace(workspaceId);
    if (generation !== generationRef.current) return result;
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setError(null);
      setCorrections(sortReceptionItemCorrections(result.data || []));
    }
    return result;
  }, [repository, workspaceId]);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    if (!workspaceId) {
      setCorrections([]);
      setLoading(false);
      setError(null);
      return undefined;
    }
    setCorrections([]);
    setLoading(true);
    setError(null);
    void repository.listByWorkspace(workspaceId).then((result) => {
      if (generation !== generationRef.current) return;
      setLoading(false);
      if (result.error) setError(result.error);
      else setCorrections(sortReceptionItemCorrections(result.data || []));
    });
    const channel = repository.subscribe(workspaceId, (event) => {
      if (generation === generationRef.current) {
        if (event?.eventType === 'DELETE') remove(event?.record);
        else merge(event?.record);
      }
    }, (status) => {
      if (generation === generationRef.current && status === 'CHANNEL_ERROR') {
        setError({ code: 'RECEPTION_CORRECTION_REALTIME_UNAVAILABLE', message: 'Realtime de correcciones no disponible.' });
      }
    });
    return () => { void channel?.unsubscribe?.(); };
  }, [merge, remove, repository, workspaceId]);

  const run = useCallback((operation) => async (input) => {
    const result = await operation(input);
    if (result.error) setError(result.error);
    else if (result.data) merge(result.data);
    return result;
  }, [merge]);

  return {
    corrections,
    loading,
    error,
    refresh,
    createCorrection: run(repository.createCorrection),
    reverseCorrection: run(repository.reverseCorrection),
  };
}
