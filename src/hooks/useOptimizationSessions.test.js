import { describe, expect, it, vi } from 'vitest';
import {
  executeOptimizationSessionOperation,
  handleOptimizationSessionsRealtimeStatus,
  shouldReloadOptimizationSessionsOnRealtimeStatus,
} from './useOptimizationSessions.js';

describe('useOptimizationSessions Realtime hydration', () => {
  it('rehidrata desde remoto al confirmar la suscripción', () => {
    const setStatus = vi.fn();
    const reload = vi.fn();

    handleOptimizationSessionsRealtimeStatus('SUBSCRIBED', {
      setStatus,
      reload,
    });

    expect(shouldReloadOptimizationSessionsOnRealtimeStatus('SUBSCRIBED'))
      .toBe(true);
    expect(setStatus).toHaveBeenCalledWith('SUBSCRIBED');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('no recarga por estados transitorios o cerrados', () => {
    const reload = vi.fn();
    [
      'CONNECTING',
      'RECONNECTING',
      'TIMED_OUT',
      'CHANNEL_ERROR',
      'CLOSED',
      'inactive',
    ].forEach((status) => {
      handleOptimizationSessionsRealtimeStatus(status, { reload });
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('confirma update autoritativo sin reload posterior y siempre libera isMutating', async () => {
    const states = [];
    const reload = vi.fn();
    const onSuccess = vi.fn();
    const saved = { id: 'session-1', version: 2 };

    const result = await executeOptimizationSessionOperation({
      operation: vi.fn().mockResolvedValue({ data: saved, error: null }),
      onSuccess,
      reload,
      reloadAfterSuccess: false,
      setError: vi.fn(),
      setIsMutating: (value) => states.push(value),
    });

    expect(result.data).toEqual(saved);
    expect(onSuccess).toHaveBeenCalledWith(saved);
    expect(reload).not.toHaveBeenCalled();
    expect(states).toEqual([true, false]);
  });

  it('libera isMutating ante error o excepción', async () => {
    const errorStates = [];
    const thrownStates = [];
    const error = new Error('remote error');

    await executeOptimizationSessionOperation({
      operation: vi.fn().mockResolvedValue({ data: null, error }),
      setError: vi.fn(),
      setIsMutating: (value) => errorStates.push(value),
    });
    await expect(executeOptimizationSessionOperation({
      operation: vi.fn().mockRejectedValue(error),
      setIsMutating: (value) => thrownStates.push(value),
    })).rejects.toThrow('remote error');

    expect(errorStates).toEqual([true, false]);
    expect(thrownStates).toEqual([true, false]);
  });
});
