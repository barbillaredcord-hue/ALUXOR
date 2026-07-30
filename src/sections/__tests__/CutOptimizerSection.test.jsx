import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  buildOptimizationSessionFromCurrentResult,
  buildOptimizationSessionRevisionFromCurrentResult,
  buildOptimizationSessionWorkingInputFromCut,
  deleteOptimizationSessionAndClearActiveReference,
  getOptimizationResultCompatibility,
  isOptimizationResultCompatibleWithWorkingInput,
  persistAndOpenOptimizationSession,
  resolveOptimizationWorkingCutResult,
  resolveOptimizationWorkingCandidate,
  resolveVisibleCutOptimization,
} from '../CutOptimizerSection.jsx';
import CutOptimizerSection from '../CutOptimizerSection.jsx';
import { optimizeCuts } from '../../lib/cut-optimizer/optimizer.js';
import {
  calculateMaterial,
} from '../../lib/material-calculator/engine.js';
import {
  resolveInitialSmartCutCandidateId,
} from '../../components/material-calculator/MaterialCalculator.jsx';
import {
  getOptimizationSessionsSummary,
} from '../../lib/optimization-session/summary.js';
import {
  optimizationSessionFixture,
} from '../../lib/optimization-session/testFixtures.js';
import {
  buildOptimizationSessionSummary,
  closeOptimizationSessionWorkingState,
  confirmOptimizationSessionWorkingSave,
  createOptimizationSessionWorkingState,
  openOptimizationSessionWorkingState,
  optimizationSessionWorkingInputFromSession,
  optimizationSessionWorkingInputSignature,
  prepareOptimizationSessionWorkingUpdate,
  sessionWithOptimizationWorkingInput,
  updateOptimizationSessionWorkingInput,
} from '../../lib/optimization-session/index.js';

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

  it('consume el borrador Legacy sin sesión y sin usar Quote como puente', () => {
    const pieces = [
      { id: 'first', nombre: 'Primera', ancho: 70, alto: 40, cantidad: 1 },
      { id: 'tall', nombre: 'Alta', ancho: 30, alto: 100, cantidad: 1 },
      { id: 'large', nombre: 'Grande', ancho: 70, alto: 60, cantidad: 1 },
    ];
    const optimization = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 100,
      kerf: 0,
      allowRotation: false,
      strategy: 'input-order',
      pieces: pieces.map((piece) => ({
        id: piece.id,
        name: piece.nombre,
        width: piece.ancho,
        height: piece.alto,
        quantity: piece.cantidad,
      })),
    });
    const shelf = optimization.candidates.find(
      (candidate) => candidate.strategy === 'shelf',
    );
    const bestFit = optimization.candidates.find(
      (candidate) => candidate.strategy === 'best-fit',
    );
    const workingInput = {
      type: 'sheet',
      materialId: 'material-1',
      selectedPieceIds: pieces.map((piece) => piece.id),
      selectedCandidateId: bestFit.id,
      unit: 'cm',
      thickness: 15,
      formatWidth: 100,
      formatHeight: 100,
      kerf: 0,
      allowRotation: false,
      grainDirection: false,
      strategy: 'input-order',
    };
    const material = {
      id: 'material-1',
      nombre: 'Melamina',
      optimization: {
        mode: 'smart-cut',
        status: 'valid',
        activeCandidateId: shelf.id,
        activeSessionId: 'session-active-unchanged',
      },
      cutOptimization: {
        ...optimization,
        ...shelf,
        validation: shelf.validation,
      },
    };
    const quote = { measureRows: pieces, materialRows: [material] };
    const quoteBefore = structuredClone(quote);
    const markup = renderToStaticMarkup(
      <CutOptimizerSection
        quote={quote}
        contextQuoteId="quote-1"
        calculatorTransfer={{
          quoteId: 'quote-1',
          selectedPieceIds: workingInput.selectedPieceIds,
          material,
          config: workingInput,
          workingInput,
        }}
        decimal={(value) => String(value)}
      />,
    );

    expect(bestFit.summary).toMatchObject({
      requiredSheets: 1,
      usedArea: 10000,
      wasteArea: 0,
      utilization: 100,
    });
    expect(markup).toContain('Calculando únicamente 3 pieza(s)');
    expect(markup).toContain('Hojas necesarias</span><strong>1');
    expect(markup).toContain('Área utilizada</span><strong>1 m²');
    expect(markup).toContain('Aprovechamiento</span><strong>100%');
    expect(markup).toContain('Grosor: 15 mm');
    expect(markup).toContain('Resultado recalculado localmente');
    expect(markup).not.toContain('Resultado aplicado a Cotización');
    expect(quote).toEqual(quoteBefore);
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

  it('crea y abre una sesión desde el borrador temporal y sus métricas compatibles', async () => {
    const result = optimizeCuts({
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
    const bestFit = result.candidates.find(
      (candidate) => candidate.strategy === 'best-fit',
    );
    const selectedResult = resolveOptimizationWorkingCutResult(result, {
      selectedCandidateId: bestFit.id,
    });
    const workingInput = {
      type: 'sheet',
      materialId: 'material-1',
      selectedPieceIds: ['first', 'tall', 'large'],
      selectedCandidateId: bestFit.id,
      unit: 'cm',
      thickness: 15,
      formatWidth: 100,
      formatHeight: 100,
      kerf: 0,
      allowRotation: false,
      strategy: 'input-order',
    };
    const material = {
      id: 'material-1',
      nombre: 'Melamina',
      optimization: {
        activeSessionId: 'previous-active-session',
        activeCandidateId: result.candidates[0].id,
      },
    };
    const materialSnapshot = structuredClone(material);
    let identity = 0;
    const creation = buildOptimizationSessionFromCurrentResult({
      result: selectedResult,
      material,
      workspaceId: 'workspace-1',
      quoteId: 'quote-1',
      userId: 'user-1',
      createdAt: '2026-07-29T12:00:00.000Z',
      workingInput,
      createId: () => `new-session-identity-${identity += 1}`,
    });
    const createSession = vi.fn().mockResolvedValue({
      data: creation.session,
      error: null,
    });
    const openSession = vi.fn((saved, options) => (
      openOptimizationSessionWorkingState(
        createOptimizationSessionWorkingState(),
        saved,
        options,
      )
    ));
    const clearLegacy = vi.fn();
    const response = await persistAndOpenOptimizationSession({
      session: creation.session,
      workingInput,
      createSession,
      openSession,
      onSessionCreated: clearLegacy,
    });
    const opened = openSession.mock.results[0].value.state;
    const changedThickness = updateOptimizationSessionWorkingInput(opened, {
      ...opened.workingInput,
      thickness: 16,
    }, {
      changedAt: '2026-07-29T13:00:00.000Z',
      changedBy: 'user-1',
    });
    const restoredThickness = updateOptimizationSessionWorkingInput(
      changedThickness,
      opened.baselineInput,
      {
        changedAt: '2026-07-29T14:00:00.000Z',
        changedBy: 'user-1',
      },
    );
    const changedCandidate = updateOptimizationSessionWorkingInput(opened, {
      ...opened.workingInput,
      selectedCandidateId: result.candidates[0].id,
    }, {
      changedAt: '2026-07-29T13:00:00.000Z',
      changedBy: 'user-1',
    });
    const restoredCandidate = updateOptimizationSessionWorkingInput(
      changedCandidate,
      opened.baselineInput,
      {
        changedAt: '2026-07-29T14:00:00.000Z',
        changedBy: 'user-1',
      },
    );
    const closed = closeOptimizationSessionWorkingState(
      opened,
      creation.session.id,
    );
    const reopened = openOptimizationSessionWorkingState(
      closed,
      creation.session,
    ).state;
    const reopenedResult = resolveOptimizationWorkingCutResult(
      result,
      reopened.workingInput,
    );

    expect(response.error).toBeNull();
    expect(createSession).toHaveBeenCalledWith(creation.session);
    expect(openSession).toHaveBeenCalledWith(creation.session, {
      discardChanges: true,
      workingInput: expect.objectContaining({
        thickness: 15,
        kerf: 0,
        formatWidth: 100,
        formatHeight: 100,
        selectedCandidateId: bestFit.id,
        selectedPieceIds: ['first', 'large', 'tall'],
      }),
    });
    expect(opened).toMatchObject({
      openedSessionId: creation.session.id,
      hasUnsavedChanges: false,
      status: 'clean',
    });
    expect(optimizationSessionWorkingInputSignature(opened.baselineInput))
      .toBe(optimizationSessionWorkingInputSignature(opened.workingInput));
    expect(changedThickness.hasUnsavedChanges).toBe(true);
    expect(restoredThickness.hasUnsavedChanges).toBe(false);
    expect(changedCandidate.hasUnsavedChanges).toBe(true);
    expect(restoredCandidate.hasUnsavedChanges).toBe(false);
    expect(closed.openedSessionId).toBeNull();
    expect(reopened).toMatchObject({
      openedSessionId: creation.session.id,
      hasUnsavedChanges: false,
      status: 'clean',
    });
    expect(reopened.workingInput.thickness).toBe(15);
    expect(reopenedResult.id).toBe(bestFit.id);
    expect(reopenedResult.summary).toEqual(bestFit.summary);
    expect(optimizationSessionWorkingInputFromSession(creation.session))
      .toMatchObject({
        thickness: 15,
        selectedCandidateId: bestFit.id,
        selectedPieceIds: ['first', 'large', 'tall'],
      });
    expect(creation.session.metadata).toMatchObject({
      usedArea: bestFit.summary.usedArea,
      wasteArea: bestFit.summary.wasteArea,
      utilization: bestFit.summary.utilization,
      sheetsRequired: bestFit.summary.requiredSheets,
      selectedCandidateId: bestFit.id,
      strategy: 'best-fit',
    });
    expect(creation.session.metadata).toEqual(buildOptimizationSessionSummary({
      selectedResult,
      workingInput,
      material,
      reviewedAt: '2026-07-29T12:00:00.000Z',
    }));
    expect(creation.session.inputSignature)
      .toMatch(/^optimization-working-input-v1:/);
    expect(creation.session).not.toHaveProperty('activeSessionId');
    expect(material).toEqual(materialSnapshot);
    expect(clearLegacy).toHaveBeenCalledWith(creation.session);
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
          connection: { label: 'Sincronizado', tone: 'connected' },
          error: null,
          userError: null,
          openedSessionId: session.id,
          openedSession: session,
          openedSessionBaseline: session,
          hasUnsavedChanges: true,
          remoteUpdatePending: null,
          isMutating: false,
          reload: () => {},
          openSession: () => {},
          updateOpenedSession: () => {},
          overwriteOpenedSession: () => {},
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
      'Sincronizado',
      'Guardar nueva sesión',
      'Actualizar lista',
      'Sesión abierta',
      'Actualizar sesión',
      'Cerrar sesión',
      'Eliminar sesión',
      'Activa',
      'Abierta',
      'Cambios sin guardar',
      'Área utilizada',
      'Aprovechamiento',
      'Merma',
      'Melamina',
    ].forEach((content) => expect(markup).toContain(content));
  });

  it('revisa únicamente el contrato técnico de la sesión abierta', () => {
    const session = optimizationSessionFixture({
      id: 'session-opened',
      selectedCandidateId: null,
    });
    const result = optimizeCuts({
      sheetWidth: 122,
      sheetHeight: 244,
      kerf: 0.4,
      allowRotation: false,
      pieces: [{
        id: 'piece-1',
        name: 'Puerta',
        width: 40,
        height: 70,
        quantity: 1,
      }],
    });
    const revision = buildOptimizationSessionRevisionFromCurrentResult({
      session,
      result,
      material: {
        id: session.materialId,
        nombre: 'Melamina',
        optimization: { inputSignature: 'quote-cut-input-v1-revised' },
      },
      userId: 'user-2',
      changedAt: '2026-07-29T10:00:00.000Z',
    });

    expect(revision.success).toBe(true);
    expect(revision.session).toMatchObject({
      id: session.id,
      executionId: session.executionId,
      workspaceId: session.workspaceId,
      quoteId: session.quoteId,
      materialId: session.materialId,
      inputSignature: 'quote-cut-input-v1-revised',
      configuration: {
        kerf: 0.4,
        allowRotation: false,
      },
    });
    expect(revision.session.version).toBe(session.version);
    expect(revision.session.revision).toBe(session.revision + 1);
    expect(revision.session.metadata).toEqual(buildOptimizationSessionSummary({
      selectedResult: result,
      material: {
        id: session.materialId,
        nombre: 'Melamina',
        optimization: { inputSignature: 'quote-cut-input-v1-revised' },
      },
      reviewedAt: '2026-07-29T10:00:00.000Z',
    }));
    expect(JSON.stringify(revision.session)).not.toContain('"sheets"');
    expect(JSON.stringify(revision.session)).not.toContain('"placedPieces"');
  });

  it('Calculator y Cut Optimizer comparten 11 piezas, kerf y candidato', () => {
    const pieces = Array.from({ length: 13 }, (_, index) => ({
      id: `piece-${index + 1}`,
      nombre: `Pieza ${index + 1}`,
      ancho: index % 2 ? 42 : 36,
      alto: index % 3 ? 70 : 55,
      cantidad: 1,
    }));
    const selectedPieceIds = pieces.slice(0, 11).map((piece) => piece.id);
    const calculatorResult = calculateMaterial({
      type: 'sheet',
      pieces,
      selectedPieceIds,
      pieceUnit: 'cm',
      unit: 'cm',
      formatWidth: 122,
      formatHeight: 244,
      kerf: 0.5,
      allowRotation: true,
      strategy: 'largest-first',
      wastePercent: 0,
      marginPercent: 0,
      price: 0,
      optimize: true,
    });
    const selectedCandidateId = resolveInitialSmartCutCandidateId(
      calculatorResult.optimization,
    );
    const workingInput = {
      selectedPieceIds,
      selectedCandidateId,
      kerf: 0.5,
    };
    const cutResult = resolveOptimizationWorkingCutResult(optimizeCuts({
      sheetWidth: 122,
      sheetHeight: 244,
      kerf: workingInput.kerf,
      allowRotation: true,
      strategy: 'largest-first',
      pieces: pieces
        .filter((piece) => selectedPieceIds.includes(piece.id))
        .map((piece) => ({
          id: piece.id,
          name: piece.nombre,
          width: piece.ancho,
          height: piece.alto,
          quantity: piece.cantidad,
        })),
    }), workingInput);
    const calculatorCandidate = calculatorResult.optimization.candidates.find(
      (candidate) => candidate.id === selectedCandidateId,
    );

    expect(calculatorResult.pieces).toHaveLength(11);
    expect(cutResult.placedPieces).toHaveLength(11);
    expect(cutResult.id).toBe(selectedCandidateId);
    expect(cutResult.summary.requiredSheets)
      .toBe(calculatorCandidate.summary.requiredSheets);
    expect(cutResult.summary.utilization)
      .toBe(calculatorCandidate.summary.utilization);
    expect(cutResult.summary.usedArea)
      .toBe(calculatorCandidate.summary.usedArea);
    expect(cutResult.summary.wasteArea)
      .toBe(calculatorCandidate.summary.wasteArea);
  });

  it('hidrata sesiones anteriores desde Quote sin cambiar la referencia activa', () => {
    const session = optimizationSessionFixture({
      materialId: 'material-1',
      selectedCandidateId: 'best-fit-bbb',
    });
    const quote = {
      measureRows: Array.from({ length: 13 }, (_, index) => ({
        id: `piece-${index + 1}`,
      })),
    };
    const input = buildOptimizationSessionWorkingInputFromCut({
      session,
      quote,
      material: {
        id: 'material-1',
        ancho: 122,
        alto: 244,
        grosor: 15,
        optimization: { activeSessionId: 'another-session' },
      },
    });

    expect(input.selectedPieceIds).toHaveLength(13);
    expect(input).toMatchObject({
      materialId: 'material-1',
      formatWidth: 122,
      formatHeight: 244,
      thickness: 15,
      kerf: 0.3,
      selectedCandidateId: 'best-fit-bbb',
    });
    expect(input).not.toHaveProperty('activeSessionId');
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

  it('prioriza el candidato de la sesión abierta y persiste sus métricas actuales', () => {
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
    const shelf = recalculated.candidates.find(
      (candidate) => candidate.strategy === 'shelf',
    );
    const bestFit = recalculated.candidates.find(
      (candidate) => candidate.strategy === 'best-fit',
    );
    const workingInput = {
      selectedCandidateId: bestFit.id,
      selectedPieceIds: ['first', 'tall', 'large'],
    };
    const workingResult = resolveOptimizationWorkingCutResult(
      recalculated,
      workingInput,
    );
    const appliedShelf = {
      ...recalculated,
      ...shelf,
      validation: shelf.validation,
    };
    const visible = resolveVisibleCutOptimization({
      material: {
        optimization: {
          mode: 'smart-cut',
          status: 'valid',
          activeCandidateId: shelf.id,
        },
        cutOptimization: appliedShelf,
      },
      recalculatedResult: workingResult,
      useRecalculatedResult: true,
    });
    const session = sessionWithOptimizationWorkingInput(
      optimizationSessionFixture(),
      workingInput,
    );
    const revision = buildOptimizationSessionRevisionFromCurrentResult({
      session,
      result: visible.result,
      material: { id: session.materialId, nombre: 'Melamina' },
      userId: 'user-2',
      changedAt: '2026-07-29T10:00:00.000Z',
    });

    expect(shelf.summary.requiredSheets).toBe(2);
    expect(bestFit.summary.requiredSheets).toBe(1);
    expect(visible.source).toBe('recalculated');
    expect(visible.result.id).toBe(bestFit.id);
    expect(isOptimizationResultCompatibleWithWorkingInput({
      result: visible.result,
      recalculatedResult: recalculated,
      workingInput,
      sourcePieceCount: 3,
    })).toBe(true);
    expect(isOptimizationResultCompatibleWithWorkingInput({
      result: appliedShelf,
      recalculatedResult: recalculated,
      workingInput,
      sourcePieceCount: 3,
    })).toBe(false);
    expect(revision.session.selectedCandidateId).toBe(bestFit.id);
    expect(optimizationSessionWorkingInputFromSession(revision.session))
      .toMatchObject({
        selectedCandidateId: bestFit.id,
        selectedPieceIds: ['first', 'large', 'tall'],
      });
    expect(revision.session.metadata).toMatchObject({
      sheetsRequired: 1,
      utilization: 100,
      wasteArea: 0,
      selectedCandidateId: bestFit.id,
      strategy: 'best-fit',
    });
    expect(revision.session.configuration).toMatchObject({
      strategy: 'best-fit',
      pieceOrder: 'input-order',
    });
    expect(optimizationSessionWorkingInputFromSession(revision.session))
      .toMatchObject({
        strategy: 'best-fit',
        pieceOrder: 'input-order',
      });
    expect(revision.session).not.toHaveProperty('activeSessionId');

    const shelfWorkingResult = resolveOptimizationWorkingCutResult(
      recalculated,
      { ...workingInput, selectedCandidateId: shelf.id },
    );
    const bestFitAgain = resolveOptimizationWorkingCutResult(
      recalculated,
      workingInput,
    );
    expect(shelfWorkingResult.id).toBe(shelf.id);
    expect(shelfWorkingResult.summary.requiredSheets).toBe(2);
    expect(bestFitAgain.id).toBe(bestFit.id);
    expect(bestFitAgain.summary).toEqual(bestFit.summary);
  });

  it('recalcula kerf y resuelve el recomendado si el candidato anterior desaparece', () => {
    const pieces = [
      { id: 'piece-1', name: 'Frente', width: 40, height: 70, quantity: 1 },
      { id: 'piece-2', name: 'Costado', width: 35, height: 60, quantity: 1 },
    ];
    const previous = optimizeCuts({
      sheetWidth: 122,
      sheetHeight: 244,
      kerf: 0.3,
      pieces,
    });
    const recalculated = optimizeCuts({
      sheetWidth: 122,
      sheetHeight: 244,
      kerf: 0.5,
      pieces,
    });
    const workingInput = {
      selectedCandidateId: previous.recommendedCandidateId,
      selectedPieceIds: ['piece-1', 'piece-2'],
    };
    const resolution = resolveOptimizationWorkingCandidate(
      recalculated,
      workingInput,
    );
    const result = resolveOptimizationWorkingCutResult(
      recalculated,
      workingInput,
    );
    const compatibility = getOptimizationResultCompatibility({
      result,
      recalculatedResult: recalculated,
      workingInput,
      sourcePieceCount: pieces.length,
    });

    expect(recalculated.candidates.map((candidate) => candidate.id))
      .not.toContain(previous.recommendedCandidateId);
    expect(resolution.usedRecommendedFallback).toBe(true);
    expect(resolution.resolvedCandidateId).toBe(recalculated.recommendedCandidateId);
    expect(result.id).toBe(recalculated.recommendedCandidateId);
    expect(compatibility).toMatchObject({
      compatible: true,
      resultId: recalculated.recommendedCandidateId,
      expectedId: recalculated.recommendedCandidateId,
      resolvedCandidateId: recalculated.recommendedCandidateId,
      selectedCandidateObsolete: true,
    });
  });

  it('mantiene actualizable la sesión al cambiar estrategia y sustituir un candidato obsoleto', () => {
    const pieces = [
      { id: 'piece-1', name: 'Primera', width: 70, height: 40, quantity: 1 },
      { id: 'piece-2', name: 'Alta', width: 30, height: 100, quantity: 1 },
      { id: 'piece-3', name: 'Grande', width: 70, height: 60, quantity: 1 },
    ];
    const recalculated = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 100,
      kerf: 0,
      strategy: 'largest-first',
      allowRotation: false,
      pieces,
    });
    const workingInput = {
      selectedCandidateId: 'candidate-from-previous-strategy',
      selectedPieceIds: pieces.map((piece) => piece.id),
      strategy: 'largest-first',
    };
    const result = resolveOptimizationWorkingCutResult(
      recalculated,
      workingInput,
    );
    const compatibility = getOptimizationResultCompatibility({
      result,
      recalculatedResult: recalculated,
      workingInput,
      sourcePieceCount: pieces.length,
    });

    expect(recalculated.candidates.map((candidate) => candidate.id))
      .not.toContain(workingInput.selectedCandidateId);
    expect(result.id).toBe(recalculated.recommendedCandidateId);
    expect(compatibility.compatible).toBe(true);
    expect(compatibility.selectedCandidateObsolete).toBe(true);
  });

  it('compara filas fuente y no unidades expandidas para quantity mayor a uno', () => {
    const pieces = [
      { id: 'piece-1', name: 'Entrepaño', width: 40, height: 30, quantity: 3 },
      { id: 'piece-2', name: 'Puerta', width: 45, height: 70, quantity: 2 },
    ];
    const recalculated = optimizeCuts({
      sheetWidth: 122,
      sheetHeight: 244,
      kerf: 0.3,
      pieces,
    });
    const workingInput = {
      selectedCandidateId: recalculated.recommendedCandidateId,
      selectedPieceIds: ['piece-1', 'piece-2'],
    };
    const result = resolveOptimizationWorkingCutResult(
      recalculated,
      workingInput,
    );
    const compatibility = getOptimizationResultCompatibility({
      result,
      recalculatedResult: recalculated,
      workingInput,
      sourcePieceCount: pieces.length,
    });

    expect(result.metadata.sourcePieceCount).toBe(2);
    expect(result.metadata.inputPieceCount).toBe(5);
    expect(compatibility).toMatchObject({
      compatible: true,
      sourcePieceCount: 2,
      resultSourcePieceCount: 2,
    });
  });

  it('bloquea un resultado físicamente inválido con diagnóstico específico', () => {
    const pieces = [
      { id: 'piece-1', name: 'Frente', width: 40, height: 70, quantity: 1 },
    ];
    const recalculated = optimizeCuts({
      sheetWidth: 122,
      sheetHeight: 244,
      pieces,
    });
    const workingInput = {
      selectedCandidateId: recalculated.recommendedCandidateId,
      selectedPieceIds: ['piece-1'],
    };
    const validResult = resolveOptimizationWorkingCutResult(
      recalculated,
      workingInput,
    );
    const invalidResult = {
      ...validResult,
      valid: false,
      validation: {
        ...validResult.validation,
        isPhysicallyValid: false,
      },
    };

    expect(getOptimizationResultCompatibility({
      result: invalidResult,
      recalculatedResult: recalculated,
      workingInput,
      sourcePieceCount: 1,
    })).toMatchObject({
      compatible: false,
      code: 'physically-invalid',
      reason: 'El resultado recalculado no es físicamente válido.',
    });
  });

  it('crea v1 y conserva compatibilidad durante cuatro actualizaciones hasta v5', () => {
    const allPieces = [
      { id: 'piece-1', name: 'Frente', width: 40, height: 70, quantity: 1 },
      { id: 'piece-2', name: 'Costado', width: 35, height: 60, quantity: 2 },
      { id: 'piece-3', name: 'Entrepaño', width: 50, height: 30, quantity: 1 },
    ];
    const initialInput = {
      type: 'sheet',
      materialId: 'material-1',
      selectedPieceIds: allPieces.map((piece) => piece.id),
      selectedCandidateId: null,
      unit: 'cm',
      thickness: 16,
      formatWidth: 122,
      formatHeight: 244,
      kerf: 0.3,
      allowRotation: true,
      strategy: 'largest-first',
    };
    const initialOptimization = optimizeCuts({
      sheetWidth: initialInput.formatWidth,
      sheetHeight: initialInput.formatHeight,
      kerf: initialInput.kerf,
      allowRotation: initialInput.allowRotation,
      strategy: initialInput.strategy,
      pieces: allPieces,
    });
    const initialResult = resolveOptimizationWorkingCutResult(
      initialOptimization,
      initialInput,
    );
    const identifiers = ['session-cycle', 'execution-cycle'];
    const creation = buildOptimizationSessionFromCurrentResult({
      result: initialResult,
      material: { id: 'material-1', nombre: 'Melamina' },
      workspaceId: 'workspace-001',
      quoteId: 'quote-001',
      userId: 'user-a',
      createdAt: '2026-07-29T10:00:00.000Z',
      workingInput: initialInput,
      createId: () => identifiers.shift(),
    });
    let state = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      creation.session,
    ).state;
    const changes = [
      { kerf: 0.5 },
      { thickness: 18 },
      { pieceOrder: 'input-order' },
      { selectedPieceIds: ['piece-1', 'piece-3'] },
    ];
    const persistedStrategy = state.workingInput.strategy;

    expect(state).toMatchObject({
      openedSessionId: creation.session.id,
      draft: { version: 1 },
      hasUnsavedChanges: false,
    });

    changes.forEach((change, index) => {
      const expectedVersion = index + 1;
      const nextInput = {
        ...state.workingInput,
        ...change,
      };
      state = updateOptimizationSessionWorkingInput(state, nextInput, {
        changedAt: `2026-07-29T1${index + 1}:00:00.000Z`,
        changedBy: 'user-a',
      });
      const sourcePieces = allPieces.filter((piece) => (
        nextInput.selectedPieceIds.includes(piece.id)
      ));
      const recalculated = optimizeCuts({
        sheetWidth: nextInput.formatWidth,
        sheetHeight: nextInput.formatHeight,
        kerf: nextInput.kerf,
        allowRotation: nextInput.allowRotation,
        strategy: nextInput.strategy,
        pieces: sourcePieces,
      });
      const selectedResult = resolveOptimizationWorkingCutResult(
        recalculated,
        nextInput,
      );
      const compatibility = getOptimizationResultCompatibility({
        result: selectedResult,
        recalculatedResult: recalculated,
        workingInput: nextInput,
        sourcePieceCount: sourcePieces.length,
      });
      const revision = buildOptimizationSessionRevisionFromCurrentResult({
        session: state.draft,
        result: selectedResult,
        material: { id: 'material-1', nombre: 'Melamina' },
        userId: 'user-a',
        changedAt: `2026-07-29T1${index + 1}:30:00.000Z`,
        workingInput: nextInput,
      });
      const persistedInput = optimizationSessionWorkingInputFromSession(
        revision.session,
      );
      const prepared = prepareOptimizationSessionWorkingUpdate(
        state,
        revision.session,
      );

      expect(compatibility.compatible).toBe(true);
      expect(revision.success, JSON.stringify(revision.errors)).toBe(true);
      expect(persistedInput.selectedCandidateId).toBe(selectedResult.id);
      expect(prepared).toMatchObject({
        expectedVersion,
        session: {
          id: creation.session.id,
          version: expectedVersion,
          selectedCandidateId: selectedResult.id,
        },
      });

      state = confirmOptimizationSessionWorkingSave(prepared.state, {
        ...prepared.session,
        version: expectedVersion + 1,
      });
      expect(state).toMatchObject({
        openedSessionId: creation.session.id,
        baseline: { version: expectedVersion + 1 },
        draft: { version: expectedVersion + 1 },
        hasUnsavedChanges: false,
        remoteUpdatePending: null,
        status: 'clean',
      });
      expect(state.workingInput.selectedCandidateId).toBe(selectedResult.id);
      expect(state.workingInput.strategy).toBe(persistedStrategy);
    });

    expect(state.draft.version).toBe(5);
  });

  it('muestra Best Fit desde la sesión abierta sin aplicar el candidato a Quote', () => {
    const pieces = [
      { id: 'first', nombre: 'Primera', ancho: 70, alto: 40, cantidad: 1 },
      { id: 'tall', nombre: 'Alta', ancho: 30, alto: 100, cantidad: 1 },
      { id: 'large', nombre: 'Grande', ancho: 70, alto: 60, cantidad: 1 },
    ];
    const calculated = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 100,
      kerf: 0,
      allowRotation: false,
      strategy: 'input-order',
      pieces: pieces.map((piece) => ({
        id: piece.id,
        name: piece.nombre,
        width: piece.ancho,
        height: piece.alto,
        quantity: piece.cantidad,
      })),
    });
    const shelf = calculated.candidates.find(
      (candidate) => candidate.strategy === 'shelf',
    );
    const bestFit = calculated.candidates.find(
      (candidate) => candidate.strategy === 'best-fit',
    );
    const material = {
      id: 'material-1',
      nombre: 'Melamina',
      ancho: 100,
      alto: 100,
      optimization: {
        mode: 'smart-cut',
        status: 'valid',
        activeCandidateId: shelf.id,
      },
      cutOptimization: {
        ...calculated,
        ...shelf,
        validation: shelf.validation,
      },
    };
    const workingInput = {
      type: 'sheet',
      materialId: material.id,
      selectedPieceIds: pieces.map((piece) => piece.id),
      selectedCandidateId: bestFit.id,
      unit: 'cm',
      thickness: 15,
      formatWidth: 100,
      formatHeight: 100,
      kerf: 0,
      allowRotation: false,
      strategy: 'input-order',
    };
    const opened = sessionWithOptimizationWorkingInput(
      optimizationSessionFixture({ materialId: material.id }),
      workingInput,
    );
    const markup = renderToStaticMarkup(
      <CutOptimizerSection
        quote={{ measureRows: pieces, materialRows: [material] }}
        contextQuoteId={opened.quoteId}
        calculatorTransfer={{
          quoteId: opened.quoteId,
          selectedPieceIds: ['first'],
          material,
          config: {
            ...workingInput,
            selectedPieceIds: ['first'],
            selectedCandidateId: shelf.id,
          },
          workingInput: {
            ...workingInput,
            selectedPieceIds: ['first'],
            selectedCandidateId: shelf.id,
          },
        }}
        optimizationSessionContext={{
          workspaceId: opened.workspaceId,
          quoteId: opened.quoteId,
          userId: opened.createdBy,
        }}
        optimizationSessions={{
          sessions: [opened],
          openedSessionId: opened.id,
          openedSession: opened,
          openedSessionInput: workingInput,
          hasUnsavedChanges: true,
          connection: { label: 'Sincronizado', tone: 'connected' },
          setOpenedSessionDraft: () => {},
          setOpenedSessionInput: () => {},
          updateOpenedSession: () => Promise.resolve({ data: opened, error: null }),
          createSession: () => {},
          openSession: () => {},
          deleteSession: () => {},
          setActiveSession: () => {},
          closeSession: () => {},
          reopenSession: () => {},
          reload: () => {},
        }}
        decimal={(value) => String(value)}
      />,
    );
    const shelfWorkingInput = {
      ...workingInput,
      selectedCandidateId: shelf.id,
      strategy: 'shelf',
    };
    const shelfOpened = sessionWithOptimizationWorkingInput(
      optimizationSessionFixture({ materialId: material.id }),
      shelfWorkingInput,
    );
    const shelfMarkup = renderToStaticMarkup(
      <CutOptimizerSection
        quote={{ measureRows: pieces, materialRows: [material] }}
        contextQuoteId={shelfOpened.quoteId}
        optimizationSessionContext={{
          workspaceId: shelfOpened.workspaceId,
          quoteId: shelfOpened.quoteId,
          userId: shelfOpened.createdBy,
        }}
        optimizationSessions={{
          sessions: [shelfOpened],
          openedSessionId: shelfOpened.id,
          openedSession: shelfOpened,
          openedSessionInput: shelfWorkingInput,
          hasUnsavedChanges: true,
          connection: { label: 'Sincronizado', tone: 'connected' },
          setOpenedSessionDraft: () => {},
          setOpenedSessionInput: () => {},
          updateOpenedSession: () => Promise.resolve({
            data: shelfOpened,
            error: null,
          }),
          createSession: () => {},
          openSession: () => {},
          deleteSession: () => {},
          setActiveSession: () => {},
          closeSession: () => {},
          reopenSession: () => {},
          reload: () => {},
        }}
        decimal={(value) => String(value)}
      />,
    );

    expect(markup).toContain('Hojas necesarias</span><strong>1');
    expect(markup).toContain('Aprovechamiento</span><strong>100%');
    expect(markup).toContain('Resultado recalculado localmente');
    expect(markup).not.toContain('Resultado aplicado a Cotización');
    expect(markup).toMatch(/<button[^>]*>Actualizar sesión<\/button>/);
    expect(markup).not.toContain('El resultado actual está pendiente de recálculo.');
    expect(markup.match(/class="cut-sheet-card"/g)).toHaveLength(1);
    expect(markup).toContain('Estrategia: Best Fit');
    expect(shelfMarkup.match(/class="cut-sheet-card"/g)).toHaveLength(2);
    expect(shelfMarkup).toContain('Estrategia: Shelf');
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
