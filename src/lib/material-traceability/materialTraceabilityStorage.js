import { compareMaterialTraceEvents, normalizeMaterialTraceEvent } from './materialTraceabilityEngine.js';

const PREFIX = 'aluxor.materialTraceEvents';
function storage() { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
function key(workspaceId) { return `${PREFIX}.${workspaceId}`; }

export function loadMaterialTraceEventCache(workspaceId) {
  if (!workspaceId) return [];
  try {
    const parsed = JSON.parse(storage()?.getItem(key(workspaceId)) || '[]');
    return (Array.isArray(parsed) ? parsed : []).map(normalizeMaterialTraceEvent)
      .filter((event) => event.workspaceId === workspaceId && event.id)
      .sort(compareMaterialTraceEvents);
  } catch { return []; }
}

export function saveMaterialTraceEventCache(workspaceId, events) {
  const byId = new Map((Array.isArray(events) ? events : []).map((event) => {
    const normalized = normalizeMaterialTraceEvent(event);
    return [normalized.id, normalized];
  }));
  const next = [...byId.values()].filter((event) => event.id && event.workspaceId === workspaceId)
    .sort(compareMaterialTraceEvents);
  try { storage()?.setItem(key(workspaceId), JSON.stringify(next)); } catch { /* React conserva la copia. */ }
  return next;
}

export const MaterialTraceabilityStorage = Object.freeze({
  load: loadMaterialTraceEventCache,
  save: saveMaterialTraceEventCache,
});
