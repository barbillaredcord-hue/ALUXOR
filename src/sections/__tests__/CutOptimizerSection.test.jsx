import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  buildOptimizationSessionFromCurrentResult,
  deleteOptimizationSessionAndClearActiveReference,
  resolveVisibleCutOptimization,
} from '../CutOptimizerSection.jsx';
import CutOptimizerSection from '../CutOptimizerSection.jsx';
import { optimizeCuts } from '../../lib/cut-optimizer/optimizer.js';
import {
  getOptimizationSessionsSummary,
} from '../../lib/optimization-session/summary.js';
import {
  optimizationSessionFixture,
} from '../../lib/optimization-session/testFixtures.js';

describe('CutOptimizerSection calculator transfer', () => {
  it('optimiza únicamente las piezas enviadas por la calculadora', () => {
    const markup = renderToStaticMarkup(
      <CutOptimizerSection
        quote={{
          measureRows: [
            { id: 'selected', nombre: 'Puerta', ancho: 40, alto: 70, cantidad: 1 },
            { id: 'excluded', nombre: 'Respaldo', ancho: 100, alto: 100, cantidad: 4 },
          ],
          materialRows: [],
        }}
        calculatorTransfer={{
          quoteId: 'q1',
          selectedPieceIds: ['selected'],
          material: { id: 'm1', nombre: 'Melamina' },
          config: {
            unit: 'cm',
            formatWidth: 122,
            formatHeight: 244,
            kerf: 0.3,
            allowRotation: true,
          },
        }}
        contextQuoteId="q1"
        decimal={(value) => String(value)}
      />,
    );

    expect(markup).toContain('Calculando únicamente 1 pieza(s)');
    expect(markup).toContain('Abrir BR Material Studio');
    expect(markup).toContain('Puerta');
    expect(markup).not.toContain('Respaldo');
  });

  it('construye la sesión desde el resultado visible sin copiar geometría', () => {
    const result = optimizeCuts({
      sheetWidth: 122,
      sheetHeight: 244,
      kerf: 0.3,
      allowRotation: true,
      pieces: [{
        id: 'piece-1',
        name: 'Puerta',
        width: 40,
        height: 70,
        quantity: 1,
      }],
    });
    let identity = 0;
    const creation = buildOptimizationSessionFromCurrentResult({
      result,
      material: {
        id: 'material-1',
        nombre: 'Melamina',
        optimization: { inputSignature: 'quote-cut-input-v1-test' },
      },
      workspaceId: 'workspace-1',
      quoteId: 'quote-1',
      userId: 'user-1',
      createdAt: '2026-07-28T12:00:00.000Z',
      createId: () => `identity-${identity += 1}`,
    });

    expect(creation.success).toBe(true);
    expect(creation.session).toMatchObject({
      id: 'identity-1',
      executionId: 'identity-2',
      workspaceId: 'workspace-1',
      quoteId: 'quote-1',
      materialId: 'material-1',
      inputSignature: 'quote-cut-input-v1-test',
      metadata: {
        source: 'cut-optimizer-ui',
        materialName: 'Melamina',
        usedArea: result.summary.usedArea,
        utilization: result.summary.utilization,
        wasteArea: result.summary.wasteArea,
      },
    });
    expect(creation.session.candidateIds)
      .toEqual(result.candidates.map((candidate) => candidate.id).sort());
    expect(JSON.stringify(creation.session)).not.toContain('"sheets"');
    expect(JSON.stringify(creation.session)).not.toContain('"placedPieces"');
  });

  it('integra sesiones, summary, Realtime y acciones dentro del optimizador', () => {
    const session = optimizationSessionFixture({
      id: 'session-1',
      materialId: 'material-1',
      metadata: {
        materialName: 'Melamina',
        usedArea: 2800,
        utilization: 72,
        wasteArea: 1200,
      },
    });
    const sessions = [session];
    const markup = renderToStaticMarkup(
      <CutOptimizerSection
        quote={{
          measureRows: [
            { id: 'piece-1', nombre: 'Puerta', ancho: 40, alto: 70, cantidad: 1 },
          ],
          materialRows: [{
            id: 'material-1',
            nombre: 'Melamina',
            ancho: 122,
            alto: 244,
            optimization: {
              inputSignature: 'quote-cut-input-v1-test',
              activeSessionId: 'session-1',
            },
          }],
        }}
        contextQuoteId="quote-1"
        optimizationSessionContext={{
          workspaceId: 'workspace-1',
          quoteId: 'quote-1',
          userId: 'user-1',
        }}
        optimizationSessions={{
          sessions,
          summary: getOptimizationSessionsSummary(sessions),
          latestSession: session,
          realtimeStatus: 'SUBSCRIBED',
          error: null,
          reload: () => {},
          createSession: () => {},
          updateSession: () => {},
          deleteSession: () => {},
          setActiveSession: () => {},
          closeSession: () => {},
          reopenSession: () => {},
        }}
        decimal={(value) => String(value)}
      />,
    );

    [
      'Optimization Sessions',
      'Connected',
      'Guardar sesión',
      'Actualizar lista',
      'Abrir sesión',
      'Actualizar sesión',
      'Cerrar sesión',
      'Eliminar sesión',
      'Sesión activa',
      'Área utilizada',
      'Aprovechamiento',
      'Merma',
      'Melamina',
    ].forEach((content) => expect(markup).toContain(content));
  });

  it('muestra y guarda el Best Fit aplicado en lugar del fallback Shelf', () => {
    const recalculated = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 100,
      kerf: 0,
      allowRotation: false,
      strategy: 'input-order',
      pieces: [
        { id: 'first', name: 'Primera', width: 70, height: 40, quantity: 1 },
        { id: 'tall', name: 'Alta', width: 30, height: 100, quantity: 1 },
        { id: 'large', name: 'Grande', width: 70, height: 60, quantity: 1 },
      ],
    });
    const bestFit = recalculated.candidates.find(
      (candidate) => candidate.strategy === 'best-fit',
    );
    const applied = {
      ...recalculated,
      ...bestFit,
      hojas: bestFit.sheets,
      piezasColocadas: bestFit.placedPieces,
      piezasNoColocadas: bestFit.unplacedPieces,
      purchasing: { sheetsToBuy: bestFit.summary.requiredSheets },
      manufacturing: { totalCuts: bestFit.placedPieces.length },
    };
    const material = {
      id: 'material-1',
      nombre: 'Melamina',
      optimization: {
        mode: 'smart-cut',
        status: 'valid',
        activeCandidateId: bestFit.id,
        inputSignature: 'quote-cut-input-v1-test',
      },
      cutOptimization: applied,
    };
    const visible = resolveVisibleCutOptimization({
      material,
      recalculatedResult: recalculated,
    });
    const creation = buildOptimizationSessionFromCurrentResult({
      result: visible.result,
      material,
      workspaceId: 'workspace-1',
      quoteId: 'quote-1',
      userId: 'user-1',
      createdAt: '2026-07-28T12:00:00.000Z',
      createId: (() => {
        let id = 0;
        return () => `session-identity-${id += 1}`;
      })(),
    });

    expect(visible.source).toBe('applied');
    expect(visible.result.strategy).toBe('best-fit');
    expect(visible.result.summary.requiredSheets).toBe(1);
    expect(creation.success).toBe(true);
    expect(creation.session.selectedCandidateId).toBe(bestFit.id);
    expect(creation.session.metadata).toMatchObject({
      sheetsRequired: 1,
      selectedCandidateId: bestFit.id,
      strategy: 'best-fit',
    });
  });
});

describe('referencia activa de Optimization Sessions', () => {
  it('eliminar la sesión activa limpia Quote después del delete confirmado', async () => {
    const deleteSession = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateQuoteReference = vi.fn().mockResolvedValue(true);
    const session = {
      id: 'session-active',
      materialId: 'material-1',
      version: 3,
    };
    const response = await deleteOptimizationSessionAndClearActiveReference({
      session,
      activeSessionId: session.id,
      deleteSession,
      onActivateSessionReference: updateQuoteReference,
      options: { expectedVersion: 3 },
    });

    expect(response.error).toBeNull();
    expect(deleteSession).toHaveBeenCalledWith('session-active', { expectedVersion: 3 });
    expect(updateQuoteReference).toHaveBeenCalledWith('material-1', null);
  });

  it('no limpia Quote al eliminar una sesión distinta o si falla el delete', async () => {
    const updateQuoteReference = vi.fn();
    await deleteOptimizationSessionAndClearActiveReference({
      session: { id: 'session-other', materialId: 'material-1' },
      activeSessionId: 'session-active',
      deleteSession: vi.fn().mockResolvedValue({ data: null, error: null }),
      onActivateSessionReference: updateQuoteReference,
    });
    await deleteOptimizationSessionAndClearActiveReference({
      session: { id: 'session-active', materialId: 'material-1' },
      activeSessionId: 'session-active',
      deleteSession: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'DELETE_FAILED' },
      }),
      onActivateSessionReference: updateQuoteReference,
    });

    expect(updateQuoteReference).not.toHaveBeenCalled();
  });
});
