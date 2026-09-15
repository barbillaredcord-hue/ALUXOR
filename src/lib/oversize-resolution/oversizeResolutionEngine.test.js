import { describe, expect, it } from 'vitest';
import {
  MATERIAL_LAYOUT_TYPES,
  OVERSIZE_ALTERNATIVE_TYPES,
  OVERSIZE_REASONS,
  resolveOversizePiece,
  suggestMaterialLayoutType,
} from './oversizeResolutionEngine.js';

const sheet = {
  id: 'current-122x244',
  materialId: 'melamine-16',
  width: 122,
  height: 244,
  price: 1200,
  unit: 'cm',
};

function resolve(piece, config = {}, alternativeFormats = []) {
  return resolveOversizePiece({
    piece: { id: 'piece-1', name: 'Panel', quantity: 1, ...piece },
    sheet,
    alternativeFormats,
    config: {
      unit: 'cm',
      allowRotation: true,
      allowSplit: true,
      maxJoints: 1,
      kerf: 0.3,
      ...config,
    },
  });
}

describe('oversize resolution engine', () => {
  it('distingue pieza que cabe, ancho, largo y ambos ejes', () => {
    expect(resolve({ width: 60, height: 200 }).oversized).toBe(false);
    expect(resolve({ width: 130, height: 200 }, { allowRotation: false }).reason)
      .toBe(OVERSIZE_REASONS.EXCEEDS_SHEET_WIDTH);
    expect(resolve({ width: 60, height: 263 }, { allowRotation: false }).reason)
      .toBe(OVERSIZE_REASONS.EXCEEDS_SHEET_LENGTH);
    expect(resolve({ width: 130, height: 263 }, { allowRotation: false }).reason)
      .toBe(OVERSIZE_REASONS.EXCEEDS_BOTH_AXES);
  });

  it('acepta la rotación válida y clasifica las restricciones de orientación y veta', () => {
    expect(resolve({ width: 200, height: 100 }).oversized).toBe(false);
    expect(resolve({ width: 200, height: 100 }, { allowRotation: false }).reason)
      .toBe(OVERSIZE_REASONS.NO_VALID_ORIENTATION);
    expect(resolve({ width: 200, height: 100, grainDirection: 'vertical' }).reason)
      .toBe(OVERSIZE_REASONS.GRAIN_CONSTRAINT);
  });

  it('considera márgenes útiles y normaliza unidades', () => {
    const result = resolveOversizePiece({
      piece: { id: 'metric', name: 'Métrica', width: 1190, height: 2000, unit: 'mm' },
      sheet: { ...sheet, width: 1220, height: 2440, unit: 'mm', margins: 20 },
      config: { unit: 'mm', allowRotation: false, kerf: 3 },
    });
    expect(result.reason).toBe(OVERSIZE_REASONS.EXCEEDS_SHEET_WIDTH);
    expect(result.excess).toEqual({ width: 1, length: 0, unit: 'cm' });
  });

  it('genera únicamente formatos mayores explícitos, activos y compatibles', () => {
    const result = resolve(
      { width: 67, height: 263 },
      { allowSplit: false },
      [
        {
          id: 'compatible', materialId: 'melamine-16', width: 152, height: 305,
          unit: 'cm', price: 1800, active: true,
        },
        {
          id: 'other-material', materialId: 'mdf', width: 152, height: 305,
          unit: 'cm', active: true,
        },
        {
          id: 'inactive', materialId: 'melamine-16', width: 152, height: 305,
          unit: 'cm', active: false,
        },
      ],
    );
    const larger = result.alternatives.filter((alternative) => (
      alternative.type === OVERSIZE_ALTERNATIVE_TYPES.LARGER_FORMAT
    ));
    expect(larger).toHaveLength(1);
    expect(larger[0]).toMatchObject({
      feasible: true,
      joints: 0,
      estimatedSheets: 1,
      estimatedCost: 1800,
      sheetFormat: { id: 'compatible', width: 152, height: 305 },
    });
    expect(larger[0].resultingPieces[0]).toMatchObject({ width: 67, height: 263 });
  });

  it('no inventa un formato mayor cuando la lista está vacía', () => {
    const result = resolve({ width: 67, height: 263 }, { allowSplit: false });
    expect(result.alternatives.some((alternative) => (
      alternative.type === OVERSIZE_ALTERNATIVE_TYPES.LARGER_FORMAT
    ))).toBe(false);
  });

  it('sugiere cobertura modular sin convertir el nombre en fuente definitiva', () => {
    expect(suggestMaterialLayoutType({ nombre: 'Lambrín nogal' }))
      .toBe(MATERIAL_LAYOUT_TYPES.MODULAR_PLANK);
    expect(suggestMaterialLayoutType({ nombre: 'Perfil aluminio' }))
      .toBe(MATERIAL_LAYOUT_TYPES.SHEET);
    expect(suggestMaterialLayoutType({
      nombre: 'Lambrín', materialLayoutType: MATERIAL_LAYOUT_TYPES.SHEET,
    })).toBe(MATERIAL_LAYOUT_TYPES.SHEET);
    const special = resolve({ width: 67, height: 263 }, {
      materialLayoutType: MATERIAL_LAYOUT_TYPES.SPECIAL,
    }, [{
      id: 'large', materialId: 'melamine-16', width: 152, height: 305,
      unit: 'cm', active: true,
    }]);
    expect(special.alternatives.map((alternative) => alternative.type))
      .toEqual([OVERSIZE_ALTERNATIVE_TYPES.SPECIAL_FABRICATION]);
  });

  it('prioriza cinco tiras físicas para 67 x 263 sobre lambrín 16 x 290', () => {
    const result = resolveOversizePiece({
      piece: { id: 'lambrin-surface', name: 'Superficie', width: 67, height: 263, quantity: 1 },
      sheet: {
        id: 'lambrin-16x290', materialId: 'lambrin', width: 16, height: 290,
        unit: 'cm', price: 100,
      },
      config: {
        unit: 'cm',
        materialLayoutType: MATERIAL_LAYOUT_TYPES.MODULAR_PLANK,
        installationOrientation: 'vertical',
        allowRotation: true,
        allowSplit: true,
        kerf: 0.3,
      },
    });
    const modular = result.alternatives[0];
    expect(result.reason).toBe(OVERSIZE_REASONS.EXCEEDS_SHEET_WIDTH);
    expect(result.recommendationId).toBe(modular.id);
    expect(modular).toMatchObject({
      type: OVERSIZE_ALTERNATIVE_TYPES.MODULAR_VERTICAL,
      feasible: true,
      estimatedSheets: 5,
      modularCoverage: {
        stripsRequired: 5,
        cutLengthPerStrip: 263,
        grossCoverage: 80,
        trimWidth: 13,
        offcutLengthPerStrip: 27,
      },
    });
    expect(modular.resultingPieces).toHaveLength(5);
    expect(modular.resultingPieces.every((piece) => (
      piece.width === 16
      && piece.height === 263
      && piece.sourcePieceId === 'lambrin-surface'
      && piece.modularCoverage === true
    ))).toBe(true);
    expect(result.alternatives.some((alternative) => (
      alternative.type === OVERSIZE_ALTERNATIVE_TYPES.BALANCED_SPLIT
    ))).toBe(false);
  });

  it('incluye horizontal solo si es válida y firma cambios de configuración modular', () => {
    const input = {
      piece: { id: 'surface', width: 67, height: 263, quantity: 1 },
      sheet: { id: 'plank', materialId: 'lambrin', width: 16, height: 290, unit: 'cm' },
      config: {
        materialLayoutType: MATERIAL_LAYOUT_TYPES.MODULAR_PLANK,
        installationOrientation: 'vertical',
        allowRotation: true,
        jointGap: 0,
      },
    };
    const base = resolveOversizePiece(input);
    expect(base.alternatives.some((alternative) => (
      alternative.type === OVERSIZE_ALTERNATIVE_TYPES.MODULAR_HORIZONTAL
    ))).toBe(true);
    const noHorizontal = resolveOversizePiece({
      ...input,
      config: { ...input.config, allowRotation: false },
    });
    expect(noHorizontal.alternatives.some((alternative) => (
      alternative.type === OVERSIZE_ALTERNATIVE_TYPES.MODULAR_HORIZONTAL
    ))).toBe(false);
    expect(resolveOversizePiece({
      ...input,
      config: { ...input.config, jointGap: 0.5 },
    }).inputSignature).not.toBe(base.inputSignature);
  });

  it('crea una división equilibrada exacta, trazable y de una unión', () => {
    const result = resolve({ width: 67, height: 263 }, { allowRotation: false });
    const balanced = result.alternatives.find((alternative) => (
      alternative.type === OVERSIZE_ALTERNATIVE_TYPES.BALANCED_SPLIT
    ));
    expect(balanced).toMatchObject({ feasible: true, joints: 1 });
    expect(balanced.resultingPieces).toHaveLength(2);
    expect(balanced.resultingPieces.map((piece) => piece.height)).toEqual([131.5, 131.5]);
    expect(balanced.resultingPieces.every((piece) => (
      piece.width === 67
      && piece.sourcePieceId === 'piece-1'
      && piece.sectionCount === 2
    ))).toBe(true);
    expect(balanced.resultingPieces.reduce((total, piece) => total + piece.height, 0))
      .toBe(263);
  });

  it('no genera divisiones si allowSplit es falso o maxJoints no es uno', () => {
    const withoutPermission = resolve({ width: 67, height: 263 }, { allowSplit: false });
    const invalidJointContract = resolve({ width: 67, height: 263 }, { maxJoints: 2 });
    [withoutPermission, invalidJointContract].forEach((result) => {
      expect(result.alternatives.some((alternative) => (
        [
          OVERSIZE_ALTERNATIVE_TYPES.BALANCED_SPLIT,
          OVERSIZE_ALTERNATIVE_TYPES.OPTIMIZED_SPLIT,
        ].includes(alternative.type)
      ))).toBe(false);
    });
  });

  it('evalúa mitad, máximo útil, 75/25 y 60/40 mediante Smart Cut sin duplicados', () => {
    const result = resolve({ width: 67, height: 300 }, { allowRotation: false });
    const optimized = result.alternatives.find((alternative) => (
      alternative.type === OVERSIZE_ALTERNATIVE_TYPES.OPTIMIZED_SPLIT
    ));
    expect(optimized.evaluatedSplitPoints).toHaveLength(4);
    expect(optimized.evaluatedSplitPoints.map((option) => option.sizes)).toEqual([
      [150, 150],
      [244, 56],
      [225, 75],
      [180, 120],
    ]);
    expect(optimized.evaluation.candidateId).toBeTruthy();
    expect(optimized.feasible).toBe(true);
  });

  it('conserva fabricación especial visible y fuera de Smart Cut', () => {
    const result = resolve({ width: 200, height: 300 }, { allowSplit: false });
    const special = result.alternatives.find((alternative) => (
      alternative.type === OVERSIZE_ALTERNATIVE_TYPES.SPECIAL_FABRICATION
    ));
    expect(special).toMatchObject({
      feasible: false,
      requiresSpecialFabrication: true,
      estimatedSheets: null,
    });
    expect(special.resultingPieces).toEqual([
      expect.objectContaining({ id: 'piece-1', width: 200, height: 300 }),
    ]);
  });

  it('ordena y recomienda de forma determinista, priorizando la pieza completa', () => {
    const formats = [{
      id: 'large', materialId: 'melamine-16', width: 152, height: 305,
      unit: 'cm', price: 1800, active: true,
    }];
    const first = resolve({ width: 67, height: 263 }, {}, formats);
    const second = resolve({ width: 67, height: 263 }, {}, formats);
    expect(first).toEqual(second);
    expect(first.recommendationId).toBe('larger-format:large:piece-1');
    expect(first.alternatives.map((alternative) => alternative.rank))
      .toEqual(first.alternatives.map((_, index) => index + 1));
    expect(first.diagnostics[0].message).toContain('conserva la pieza completa');
  });

  it('firma pieza, hoja, kerf, rotación, veta y material para detectar obsolescencia', () => {
    const base = resolve({ width: 67, height: 263 }, { allowRotation: false });
    const signatures = [
      resolve({ width: 68, height: 263 }, { allowRotation: false }).inputSignature,
      resolve({ width: 67, height: 264 }, { allowRotation: false }).inputSignature,
      resolve({ width: 67, height: 263, quantity: 2 }, { allowRotation: false }).inputSignature,
      resolve({ width: 67, height: 263 }, { allowRotation: false, kerf: 0.4 }).inputSignature,
      resolve({ width: 67, height: 263 }, { allowRotation: true }).inputSignature,
      resolve({ width: 67, height: 263, grainDirection: 'vertical' }, { allowRotation: false })
        .inputSignature,
      resolveOversizePiece({
        piece: { id: 'piece-1', width: 67, height: 263, unit: 'cm' },
        sheet: { ...sheet, materialId: 'other-material' },
        config: { unit: 'cm', allowRotation: false },
      }).inputSignature,
      resolveOversizePiece({
        piece: { id: 'piece-1', width: 67, height: 263, unit: 'cm' },
        sheet: { ...sheet, width: 130 },
        config: { unit: 'cm', allowRotation: false },
      }).inputSignature,
    ];
    expect(signatures.every((signature) => signature !== base.inputSignature)).toBe(true);
    const metricEquivalent = resolveOversizePiece({
      piece: { id: 'piece-1', width: 670, height: 2630, unit: 'mm' },
      sheet: {
        ...sheet, width: 1220, height: 2440, unit: 'mm', price: 1200,
      },
      config: { unit: 'mm', allowRotation: false, kerf: 3 },
    });
    expect(metricEquivalent.inputSignature).toBe(base.inputSignature);
  });

  it('no muta pieza, hoja, formatos ni configuración', () => {
    const piece = { id: 'immutable', width: 67, height: 263, quantity: 1 };
    const currentSheet = { ...sheet };
    const formats = [{
      id: 'large', materialId: 'melamine-16', width: 152, height: 305, active: true,
    }];
    const config = { unit: 'cm', allowRotation: false, allowSplit: true, maxJoints: 1 };
    const before = structuredClone({ piece, currentSheet, formats, config });
    resolveOversizePiece({ piece, sheet: currentSheet, alternativeFormats: formats, config });
    expect({ piece, currentSheet, formats, config }).toEqual(before);
  });
});
