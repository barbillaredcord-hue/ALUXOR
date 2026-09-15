import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OversizeResolutionPanel from './OversizeResolutionPanel.jsx';

const resolution = {
  oversized: true,
  reason: 'EXCEEDS_SHEET_LENGTH',
  excess: { width: 0, length: 19, unit: 'cm' },
  sourcePiece: { id: 'panel', name: 'Tablaroca', width: 67, height: 263 },
  sheet: { id: 'current', width: 122, height: 244 },
  recommendationId: 'balanced',
  inputSignature: 'signature',
  alternatives: [
    {
      id: 'balanced', type: 'balanced-split', feasible: true,
      resultingPieces: [
        { id: 'one', width: 67, height: 131.5 },
        { id: 'two', width: 67, height: 131.5 },
      ],
      sheetFormat: { width: 122, height: 244 }, joints: 1,
      estimatedSheets: 1, estimatedWaste: 1200, estimatedCost: 1200,
      respectsGrain: true, requiresSpecialFabrication: false,
      explanation: 'Divide la pieza en dos secciones iguales.', warnings: [], rank: 1,
    },
    {
      id: 'special', type: 'special-fabrication', feasible: false,
      resultingPieces: [{ id: 'panel', width: 67, height: 263 }],
      sheetFormat: null, joints: 0, estimatedSheets: null, estimatedWaste: null,
      estimatedCost: null, respectsGrain: true, requiresSpecialFabrication: true,
      explanation: 'Conserva la pieza original.', warnings: ['Requiere definición manual.'], rank: 2,
    },
  ],
};

describe('OversizeResolutionPanel', () => {
  it('muestra alerta, exceso, recomendación y acciones explícitas', () => {
    const markup = renderToStaticMarkup(
      <OversizeResolutionPanel resolutions={[resolution]} defaultExpanded />,
    );
    expect(markup).toContain('Pieza sobredimensionada detectada');
    expect(markup).toContain('Tablaroca');
    expect(markup).toContain('19 cm largo');
    expect(markup).toContain('División equilibrada');
    expect(markup).toContain('Recomendada');
    expect(markup).toContain('Resolver pieza');
    expect(markup).toContain('Ver propuesta');
    expect(markup).toContain('Aplicar propuesta');
    expect(markup).toContain('Mantener sin resolver');
  });

  it('conserva el panel compacto hasta que el usuario abre una resolución', () => {
    const markup = renderToStaticMarkup(
      <OversizeResolutionPanel resolutions={[resolution]} />,
    );
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('oversize-resolution-panel is-expanded');
    expect(markup).not.toContain('Aplicar propuesta');
  });

  it('muestra aplicación, deshacer y obsolescencia', () => {
    const applied = {
      id: 'proposal', sourcePieceId: 'panel', alternativeId: 'balanced',
      inputSignature: 'old-signature', status: 'applied',
    };
    const markup = renderToStaticMarkup(
      <OversizeResolutionPanel resolutions={[resolution]} proposals={[applied]} />,
    );
    expect(markup).toContain('La pieza cambió. Vuelve a calcular las soluciones.');
    expect(markup).toContain('Propuesta aplicada');
    expect(markup).toContain('Deshacer resolución');
  });

  it('presenta cobertura modular con métricas legibles y acciones completas', () => {
    const modular = {
      ...resolution,
      recommendationId: 'modular',
      alternatives: [{
        id: 'modular',
        type: 'modular-coverage-vertical',
        feasible: true,
        resultingPieces: Array.from({ length: 5 }, (_, index) => ({
          id: `strip-${index + 1}`, width: 16, height: 263,
        })),
        sheetFormat: { width: 16, height: 290 },
        joints: 4,
        estimatedSheets: 5,
        estimatedWaste: 2160,
        estimatedCost: 500,
        respectsGrain: true,
        requiresSpecialFabrication: false,
        explanation: 'La superficie se obtiene ensamblando cinco tiras comerciales.',
        warnings: ['La última tira requiere recorte lateral.'],
        rank: 1,
        modularCoverage: {
          stripsRequired: 5,
          cutLengthPerStrip: 263,
          grossCoverage: 80,
          netCoverage: 67,
          trimWidth: 13,
          offcutLengthPerStrip: 27,
          totalLinearLength: 1315,
          orientation: 'vertical',
        },
      }],
    };
    const markup = renderToStaticMarkup(
      <OversizeResolutionPanel resolutions={[modular]} defaultExpanded />,
    );
    expect(markup).toContain('Cobertura modular detectada');
    expect(markup).toContain('Cobertura modular vertical');
    expect(markup).toContain('Corte por tira');
    expect(markup).toContain('263 cm');
    expect(markup).toContain('Cobertura bruta');
    expect(markup).toContain('80 cm');
    expect(markup).toContain('Recorte lateral');
    expect(markup).toContain('13 cm');
    expect(markup).toContain('Sobrante por tira');
    expect(markup).toContain('27 cm');
    expect(markup).toContain('Ver detalles');
    expect(markup).toContain('Aplicar propuesta');
  });

  it('no renderiza un panel vacío', () => {
    expect(renderToStaticMarkup(<OversizeResolutionPanel />)).toBe('');
  });

  it('protege la superficie amplia, cuadrícula adaptable y móvil sin compresión', () => {
    const css = readFileSync(
      new URL('../styles/material-calculator.css', import.meta.url),
      'utf8',
    );
    expect(css).toContain('.calculator-step--result.has-expanded-resolution');
    expect(css).toContain('grid-column: 2 / 4');
    expect(css).toContain('repeat(auto-fit, minmax(min(280px, 100%), 1fr))');
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.oversize-alternatives[\s\S]*grid-template-columns: 1fr/);
  });
});
