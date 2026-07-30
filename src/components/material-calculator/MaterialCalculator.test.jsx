import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MaterialCalculator, {
  buildMaterialApplicationPayload,
  buildOptimizationSessionInputFromCalculator,
  buildTechnicalPieceLayout,
  calculationForSelectedSmartCutCandidate,
  groupPiecesByCategory,
  inferPieceCategory,
  initialMaterialCalculatorConfig,
  optimizationSessionInputForSelectedCandidate,
  pieceQuantityTotal,
  resolveInitialSmartCutCandidateId,
  sheetSummaryMetrics,
  TechnicalPieceBoard,
} from './MaterialCalculator.jsx';

const context = {
  quoteId: 'q1',
  projectId: 'ot1',
  projectName: 'Cocina Dora',
  customerName: 'Dora',
};
const pieces = [{
  id: 'p1',
  nombre: 'Costado izquierdo',
  groupId: 'g1',
  ancho: 55,
  alto: 72,
  cantidad: 1,
  materialAssignments: [{ materialId: 'm1' }],
}];
const groups = [{ id: 'g1', name: 'Mueble bajo fregadero' }];
const materials = [{ id: 'm1', nombre: 'Melamina nogal' }];

describe('MaterialCalculator', () => {
  it('renderiza el workspace profesional por áreas sin apariencia de wizard', () => {
    const markup = renderToStaticMarkup(
      <MaterialCalculator
        context={context}
        pieces={pieces}
        pieceGroups={groups}
        materials={materials}
        initialSelectedPieceIds={['p1']}
      />,
    );

    expect(markup).toContain('BR Material Studio');
    expect(markup).toContain('Volver a Cotización');
    expect(markup).toContain('Guía rápida');
    expect(markup).toContain('Modo rápido');
    expect(markup).toContain('Modo por proyecto');
    expect(markup).toContain('Tipo de cálculo');
    expect(markup).toContain('Proyecto y conjuntos');
    expect(markup).toContain('Material y configuración');
    expect(markup).toContain('Piezas y medidas');
    expect(markup).toContain('Resultado y acciones');
    expect(markup).not.toContain('Paso 1');
    expect(markup).toContain('Mueble bajo fregadero');
    expect(markup).toContain('Costado izquierdo');
    expect(markup).toContain('Aplicar a Cotización');
    expect(markup).toContain('Optimizar cortes');
    expect(markup).toContain('No hay un cálculo todavía');
    expect(markup).toContain('Cómo se forma el resultado');
    expect(markup).toContain('Sin calcular');
    expect(markup).toContain('role="table"');
    expect(markup).toContain('aria-label="Piezas incluidas en el cálculo"');
    expect(markup).toContain('aria-label="Cadena del cálculo"');
    expect(markup).toContain('Editar');
    expect(markup).toContain('Vista conceptual de piezas');
    expect(markup).toContain('aria-controls="calculator-material-editor"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Guardar selección temporal');
    expect(markup).toContain('1 pieza(s) seleccionada(s)');
  });

  it('conserva el modo rápido independiente usando el mismo componente', () => {
    const markup = renderToStaticMarkup(
      <MaterialCalculator initialMode="quick" />,
    );

    expect(markup).toContain('Cálculo independiente');
    expect(markup).toContain('Pieza independiente');
    expect(markup).not.toContain('Esta cotización todavía no tiene conjuntos');
  });

  it('muestra estados vacíos para conjuntos, piezas y materiales', () => {
    const markup = renderToStaticMarkup(
      <MaterialCalculator context={context} pieces={[]} pieceGroups={[]} materials={[]} />,
    );

    expect(markup).toContain('Esta cotización todavía no tiene conjuntos');
    expect(markup).toContain('Este conjunto no tiene piezas');
    expect(markup).toContain('No hay materiales disponibles');
    expect(markup).toContain('Selecciona al menos una pieza');
  });

  it('aplica las métricas del candidato visualmente seleccionado y no las de Shelf', () => {
    const shelf = {
      id: 'shelf-id',
      valid: true,
      complete: true,
      validation: { isPhysicallyValid: true },
      summary: {
        requiredSheets: 2,
        usedArea: 20200,
        wasteArea: 39200,
        utilization: 34,
        placedPieceCount: 13,
        unplacedPieceCount: 0,
      },
    };
    const bestFit = {
      id: 'best-fit-id',
      valid: true,
      complete: true,
      validation: { isPhysicallyValid: true },
      summary: {
        requiredSheets: 1,
        usedArea: 20200,
        wasteArea: 9200,
        utilization: 68.8,
        placedPieceCount: 13,
        unplacedPieceCount: 0,
      },
    };
    const calculation = {
      commercialSheets: 2,
      estimatedWaste: 1.2,
      utilization: 34,
      optimization: {
        candidates: [shelf, bestFit],
        recommendedCandidateId: bestFit.id,
        candidateRanking: [
          { candidateId: bestFit.id },
          { candidateId: shelf.id },
        ],
      },
    };

    expect(resolveInitialSmartCutCandidateId(calculation.optimization)).toBe(bestFit.id);
    const effective = calculationForSelectedSmartCutCandidate(
      calculation,
      bestFit.id,
    );
    expect(effective).toMatchObject({
      commercialSheets: 1,
      estimatedWaste: 0.92,
      utilization: 68.8,
      optimization: {
        selectedCandidateId: bestFit.id,
        selectedCandidate: bestFit,
      },
    });
    expect(buildMaterialApplicationPayload({
      material: { id: 'material-1' },
      calculation,
      selectedPieceIds: ['piece-1'],
      selectedCandidateId: bestFit.id,
    })).toMatchObject({
      selectedCandidateId: bestFit.id,
      selectedCandidate: bestFit,
      calculation: {
        commercialSheets: 1,
        optimization: { selectedCandidateId: bestFit.id },
      },
    });
    expect(calculation.commercialSheets).toBe(2);

    expect(sheetSummaryMetrics(calculation, shelf.id)).toMatchObject({
      requiredSheets: 2,
      utilization: 34,
      placedPieceCount: 13,
      unplacedPieceCount: 0,
      source: 'candidate',
    });
    expect(sheetSummaryMetrics(calculation, bestFit.id)).toMatchObject({
      requiredSheets: 1,
      utilization: 68.8,
      requiredArea: 2.02,
      waste: 0.92,
      source: 'candidate',
    });
  });

  it('convierte Shelf y Best Fit en workingInput canónico de la sesión abierta', () => {
    const calculation = {
      optimization: {
        candidates: [
          { id: 'shelf-current', strategy: 'shelf' },
          { id: 'best-fit-current', strategy: 'best-fit' },
        ],
      },
    };
    const shared = {
      calculation,
      type: 'sheet',
      config: {
        materialId: 'm1',
        unit: 'cm',
        formatWidth: 122,
        formatHeight: 244,
        pieceOrder: 'largest-first',
      },
      selectedPieceIds: ['p1'],
    };

    expect(optimizationSessionInputForSelectedCandidate({
      ...shared,
      candidateId: 'shelf-current',
    })).toMatchObject({
      selectedPieceIds: ['p1'],
      selectedCandidateId: 'shelf-current',
      strategy: 'shelf',
    });
    expect(optimizationSessionInputForSelectedCandidate({
      ...shared,
      candidateId: 'best-fit-current',
    })).toMatchObject({
      selectedPieceIds: ['p1'],
      selectedCandidateId: 'best-fit-current',
      strategy: 'best-fit',
    });
  });

  it('conserva el fallback legacy y restaura candidateSnapshot al recalcular', () => {
    const optimization = {
      candidates: [
        {
          id: 'shelf-id',
          valid: true,
          complete: true,
          validation: { isPhysicallyValid: true },
        },
        {
          id: 'best-fit-id',
          valid: true,
          complete: true,
          validation: { isPhysicallyValid: true },
        },
      ],
      recommendedCandidateId: 'shelf-id',
    };
    expect(resolveInitialSmartCutCandidateId(optimization, 'best-fit-id')).toBe('best-fit-id');
    expect(initialMaterialCalculatorConfig([{
      id: 'material-1',
      nombre: 'Melamina aplicada',
      ancho: 122,
      alto: 244,
      optimization: {
        candidateSnapshot: {
          candidateId: 'best-fit-id',
          configuration: {
            sheetWidth: 100,
            sheetHeight: 200,
            kerf: 0.4,
            allowRotation: false,
          },
        },
      },
    }])).toMatchObject({
      materialId: 'material-1',
      materialName: 'Melamina aplicada',
      formatWidth: 100,
      formatHeight: 200,
      kerf: 0.4,
      allowRotation: false,
    });
    expect(sheetSummaryMetrics({
      netArea: 2.02,
      wastePercent: 8,
      areaWithWaste: 2.18,
      commercialSheets: 2,
    }, null)).toEqual({
      netArea: 2.02,
      waste: 8,
      wasteUnit: '%',
      requiredArea: 2.18,
      requiredSheets: 2,
      utilization: null,
      placedPieceCount: null,
      unplacedPieceCount: null,
      source: 'legacy',
    });
  });

  it('restaura selección y configuración desde la sesión abierta', () => {
    const sessionPieces = Array.from({ length: 13 }, (_, index) => ({
      id: `piece-${index + 1}`,
      nombre: `Pieza ${index + 1}`,
      ancho: 30,
      alto: 40,
      cantidad: 1,
    }));
    const workingInput = buildOptimizationSessionInputFromCalculator({
      type: 'sheet',
      config: {
        materialId: 'm1',
        unit: 'cm',
        thickness: 15,
        formatWidth: 122,
        formatHeight: 244,
        kerf: 0.5,
        allowRotation: false,
        grainDirection: true,
      },
      selectedPieceIds: sessionPieces
        .slice(0, 11)
        .map((piece) => piece.id)
        .sort((left, right) => left.localeCompare(right)),
      selectedCandidateId: 'candidate-11',
    });
    const markup = renderToStaticMarkup(
      <MaterialCalculator
        context={context}
        pieces={sessionPieces}
        materials={materials}
        optimizationSessionInput={workingInput}
        onApplySelectionToSession={() => {}}
      />,
    );

    expect(workingInput).toMatchObject({
      selectedPieceIds: sessionPieces
        .slice(0, 11)
        .map((piece) => piece.id)
        .sort((left, right) => left.localeCompare(right)),
      kerf: 0.5,
      thickness: 15,
      allowRotation: false,
      grainDirection: true,
      selectedCandidateId: 'candidate-11',
    });
    expect(markup).toContain('11 piezas seleccionadas');
    expect(markup).toContain('Aplicar selección');
    expect(markup).toContain('value="0.5"');
    expect(markup).toContain('value="15"');
  });

  it('reconstruye piezas y estrategia física desde workingInput al volver', () => {
    const bestFitInput = buildOptimizationSessionInputFromCalculator({
      type: 'sheet',
      config: {
        materialId: 'm1',
        unit: 'cm',
        formatWidth: 122,
        formatHeight: 244,
        pieceOrder: 'input-order',
      },
      selectedPieceIds: ['p1'],
      selectedCandidateId: 'best-fit-current',
      selectedCandidateStrategy: 'best-fit',
    });
    const reopenedMarkup = renderToStaticMarkup(
      <MaterialCalculator
        context={context}
        pieces={pieces}
        materials={materials}
        optimizationSessionInput={bestFitInput}
        onApplySelectionToSession={() => {}}
      />,
    );
    const shelfInput = buildOptimizationSessionInputFromCalculator({
      type: 'sheet',
      config: bestFitInput,
      selectedPieceIds: ['p1'],
      selectedCandidateId: 'shelf-current',
      selectedCandidateStrategy: 'shelf',
    });

    expect(bestFitInput).toMatchObject({
      selectedPieceIds: ['p1'],
      selectedCandidateId: 'best-fit-current',
      strategy: 'best-fit',
      pieceOrder: 'input-order',
    });
    expect(shelfInput).toMatchObject({
      selectedCandidateId: 'shelf-current',
      strategy: 'shelf',
      pieceOrder: 'input-order',
    });
    expect(reopenedMarkup).toContain('1 pieza(s) seleccionada(s)');
  });

  it('restaura el borrador Legacy sin abrir ni activar una sesión', () => {
    const legacyInput = buildOptimizationSessionInputFromCalculator({
      type: 'sheet',
      config: {
        materialId: 'm1',
        unit: 'cm',
        thickness: 15,
        formatWidth: 100,
        formatHeight: 200,
        kerf: 0.4,
        allowRotation: false,
      },
      selectedPieceIds: ['p1'],
      selectedCandidateId: 'best-fit-temporal',
    });
    const markup = renderToStaticMarkup(
      <MaterialCalculator
        context={context}
        pieces={pieces}
        materials={materials}
        legacyOptimizationInput={legacyInput}
        onApplySelectionToLegacy={() => {}}
      />,
    );

    expect(markup).toContain('1 pieza(s) seleccionada(s)');
    expect(markup).toContain('value="15"');
    expect(markup).toContain('value="0.4"');
    expect(markup).toContain('Aplicar selección');
    expect(markup).not.toContain('Cambios sin guardar');
  });
});

describe('jerarquía y vista técnica', () => {
  it('deriva categorías únicamente desde datos explícitos o nombres seguros', () => {
    expect(inferPieceCategory({ nombre: 'Puerta izquierda' })).toBe('Puertas');
    expect(inferPieceCategory({ nombre: 'Costado derecho' })).toBe('Estructura');
    expect(inferPieceCategory({ nombre: 'Entrepaño 1' })).toBe('Interiores');
    expect(inferPieceCategory({ nombre: 'Pieza especial' })).toBeNull();
    expect(inferPieceCategory({ nombre: 'Pieza especial', categoria: 'Remates' })).toBe('Remates');
  });

  it('mantiene piezas no clasificables directamente dentro del conjunto', () => {
    const organization = groupPiecesByCategory([
      { id: 'door', nombre: 'Puerta', cantidad: 2 },
      { id: 'special', nombre: 'Pieza especial', cantidad: 3 },
    ]);

    expect(organization.categories).toEqual([
      { name: 'Puertas', pieces: [{ id: 'door', nombre: 'Puerta', cantidad: 2 }] },
    ]);
    expect(organization.direct).toEqual([
      { id: 'special', nombre: 'Pieza especial', cantidad: 3 },
    ]);
    expect(pieceQuantityTotal([...organization.categories[0].pieces, ...organization.direct])).toBe(5);
  });

  it('representa dimensiones reales y selección sin inventar una forma de mueble', () => {
    const technicalPieces = [
      { id: 'wide', nombre: 'Piso', ancho: 100, alto: 25 },
      { id: 'tall', nombre: 'Costado', ancho: 30, alto: 90 },
    ];
    const layout = buildTechnicalPieceLayout(technicalPieces, ['tall']);
    const markup = renderToStaticMarkup(
      <TechnicalPieceBoard pieces={technicalPieces} selectedPieceIds={['tall']} />,
    );

    expect(layout.find((piece) => piece.id === 'tall').selected).toBe(true);
    expect(layout.find((piece) => piece.id === 'wide').width)
      .toBeGreaterThan(layout.find((piece) => piece.id === 'wide').height);
    expect(markup).toContain('Tablero técnico de piezas reales');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('no representa un mueble');
    expect(markup).not.toContain('3D');
  });
});
