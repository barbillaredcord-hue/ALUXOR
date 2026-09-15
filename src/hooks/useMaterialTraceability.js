import { useCallback, useEffect, useRef, useState } from 'react';
import { compareMaterialTraceEvents, normalizeMaterialTraceEvent } from '../lib/material-traceability/materialTraceabilityEngine.js';
import { MaterialTraceabilityRepository } from '../lib/material-traceability/materialTraceabilityRepository.js';
import { MaterialTraceabilityStorage } from '../lib/material-traceability/materialTraceabilityStorage.js';

export default function useMaterialTraceability({ workspaceId } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [realtimeState, setRealtimeState] = useState('idle');
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  const apply = useCallback((next) => {
    const saved = MaterialTraceabilityStorage.save(workspaceId, next);
    eventsRef.current = saved;
    setEvents(saved);
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    if (!workspaceId) { setEvents([]); return { data: [], error: null }; }
    setLoading(true);
    const result = await MaterialTraceabilityRepository.load(workspaceId);
    setLoading(false);
    setError(result.error || null);
    if (!result.error) apply(result.data || []);
    return result;
  }, [apply, workspaceId]);

  useEffect(() => {
    if (!workspaceId) { setEvents([]); return undefined; }
    setEvents(MaterialTraceabilityStorage.load(workspaceId));
    void refresh();
    return MaterialTraceabilityRepository.subscribe(workspaceId, (event) => {
      const eventType = String(event?.eventType || '').toUpperCase();
      const id = event?.record?.id || event?.oldRecord?.id;
      if (!id) return;
      if (eventType === 'DELETE') {
        apply(eventsRef.current.filter((item) => item.id !== id));
        return;
      }
      const incoming = normalizeMaterialTraceEvent(event.record);
      const next = [...eventsRef.current.filter((item) => item.id !== id), incoming]
        .sort(compareMaterialTraceEvents);
      apply(next);
    }, (status, caught) => {
      setRealtimeState(String(status || 'unknown').toLowerCase());
      if (caught) setError(caught);
    });
  }, [apply, refresh, workspaceId]);

  const purgeEvent = useCallback(async (eventId, reason) => {
    const result = await MaterialTraceabilityRepository.purge({ workspaceId, eventId, reason });
    if (result.error) setError(result.error);
    else await refresh();
    return result;
  }, [refresh, workspaceId]);

  return { events, loading, error, realtimeState, refresh, purgeEvent };
}
