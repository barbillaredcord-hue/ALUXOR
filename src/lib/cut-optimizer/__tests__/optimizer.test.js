import { describe, expect, it } from 'vitest';
import { optimizeCuts } from '../optimizer.js';

const LEGACY_RESULT_FIELDS = [
  'config',
  'sheets',
  'placedPieces',
  'hojas',
  'unplacedPieces',
  'summary',
  'purchasing',
  'manufacturing',
  'validation',
  'totalUsedArea',
  'totalWasteArea',
  'efficiencyPercent',
  'sheetCount',
  'cantidadHojas',
  'areaUtilizada',
  'areaDesperdiciada',
  'porcentajeAprovechamiento',
];

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function physicalResult(result) {
  return {
    config: result.config,
    sheets: result.sheets,
    placedPieces: result.placedPieces,
    unplacedPieces: result.unplacedPieces,
    summary: result.summary,
    purchasing: result.purchasing,
    manufacturing: result.manufacturing,
    validation: result.validation,
  };
}

describe('cut optimizer', () => {
  it('acomoda una pieza en una hoja', () => {
    const result = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, kerf: 0, pieces: [{ name: 'A', width: 50, height: 50, quantity: 1 }] });
    expect(result.sheetCount).toBe(1);
    expect(result.sheets[0].pieces).toHaveLength(1);
    expect(result.sheets[0].pieces[0]).toMatchObject({ x: 0, y: 0, width: 50, height: 50 });
  });

  it('acomoda varias piezas en una hoja', () => {
    const result = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, kerf: 0, pieces: [{ name: 'A', width: 50, height: 50, quantity: 4 }] });
    expect(result.sheetCount).toBe(1);
    expect(result.sheets[0].pieces).toHaveLength(4);
  });

  it('crea otra hoja si no caben', () => {
    const result = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, pieces: [{ name: 'A', width: 70, height: 70, quantity: 2 }] });
    expect(result.sheetCount).toBe(2);
  });

  it('calcula area usada, desperdicio y aprovechamiento', () => {
    const result = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, pieces: [{ name: 'A', width: 50, height: 50, quantity: 1 }] });
    expect(result.totalUsedArea).toBe(2500);
    expect(result.totalWasteArea).toBe(7500);
    expect(result.efficiencyPercent).toBe(25);
    expect(result.sheets[0].usedArea).toBe(2500);
  });

  it('expone salida estandar para compras, fabricacion y validacion', () => {
    const result = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, kerf: 0, pieces: [{ name: 'A', width: 50, height: 50, quantity: 2 }] });
    expect(result.summary).toMatchObject({
      requiredSheets: 1,
      totalSheetArea: 10000,
      usedArea: 5000,
      wasteArea: 5000,
      utilization: 50,
    });
    expect(result.purchasing.sheetsToBuy).toBe(1);
    expect(result.manufacturing.totalCuts).toBe(2);
    expect(result.validation.isPhysicallyValid).toBe(true);
    expect(result.validation.warnings).toEqual([]);
    expect(result.placedPieces).toHaveLength(2);
  });

  it('conserva el contrato superior y los aliases legacy de resultado', () => {
    const result = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0,
      pieces: [{ name: 'Panel', width: 50, height: 40, quantity: 2 }],
    });

    expect(Object.keys(result)).toEqual(expect.arrayContaining(LEGACY_RESULT_FIELDS));
    expect(result.hojas).toBe(result.sheets);
    expect(result.sheetCount).toBe(result.summary.requiredSheets);
    expect(result.cantidadHojas).toBe(result.summary.requiredSheets);
    expect(result.totalUsedArea).toBe(result.summary.usedArea);
    expect(result.areaUtilizada).toBe(result.summary.usedArea);
    expect(result.totalWasteArea).toBe(result.summary.wasteArea);
    expect(result.areaDesperdiciada).toBe(result.summary.wasteArea);
    expect(result.efficiencyPercent).toBe(result.summary.utilization);
    expect(result.porcentajeAprovechamiento).toBe(result.summary.utilization);
  });

  it('conserva el contrato legacy de hojas y piezas colocadas', () => {
    const result = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0,
      pieces: [{ name: 'Panel', width: 50, height: 40, quantity: 1 }],
    });
    const sheet = result.sheets[0];
    const piece = sheet.pieces[0];

    expect(sheet).toEqual(expect.objectContaining({
      index: 1,
      width: 100,
      height: 80,
      ancho: 100,
      alto: 80,
      anchoHoja: 100,
      altoHoja: 80,
      pieces: expect.any(Array),
      piezasColocadas: expect.any(Array),
      usedArea: 2000,
      wasteArea: 6000,
      efficiencyPercent: 25,
      areaUsada: 2000,
      areaDesperdiciada: 6000,
      porcentajeAprovechamiento: 25,
    }));
    expect(piece).toEqual(expect.objectContaining({
      id: 'Panel-0-0',
      name: 'Panel',
      nombre: 'Panel',
      index: 1,
      indice: 1,
      quantity: 1,
      cantidad: 1,
      originalWidth: 50,
      originalHeight: 40,
      width: 50,
      height: 40,
      ancho: 50,
      alto: 40,
      rotated: false,
      x: 0,
      y: 0,
    }));
    expect(result.placedPieces[0]).toEqual(expect.objectContaining({
      ...piece,
      sheetIndex: 1,
    }));
  });

  it('conserva explícitamente las piezas imposibles en el contrato legacy', () => {
    const result = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 80,
      pieces: [{ name: 'Panel imposible', width: 120, height: 90, quantity: 1 }],
    });

    expect(result.unplacedPieces[0]).toEqual(expect.objectContaining({
      id: 'Panel imposible-0-0',
      name: 'Panel imposible',
      index: 1,
      quantity: 1,
      originalWidth: 120,
      originalHeight: 90,
      width: 120,
      height: 90,
      rotated: false,
      reason: 'too-large',
    }));
    expect(result.placedPieces).toEqual([]);
    expect(result.validation.isPhysicallyValid).toBe(false);
  });

  it('no modifica la entrada y mantiene determinista el resultado físico', () => {
    const input = deepFreeze({
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0.2,
      allowRotation: true,
      strategy: 'largest-first',
      pieces: [
        {
          id: 'source-a',
          name: 'Panel A',
          width: 60,
          height: 30,
          quantity: 2,
          metadata: { groupId: 'group-1' },
        },
        {
          id: 'source-b',
          name: 'Panel B',
          width: 40,
          height: 20,
          quantity: 1,
        },
      ],
    });
    const snapshot = structuredClone(input);

    const first = optimizeCuts(input);
    const second = optimizeCuts(input);

    expect(input).toEqual(snapshot);
    expect(physicalResult(first)).toEqual(physicalResult(second));
  });

  it('propaga sourceId sin cambiar el id legacy', () => {
    const result = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0,
      pieces: [{
        id: 'quote-piece-1',
        name: 'Panel',
        width: 50,
        height: 40,
        quantity: 1,
      }],
    });

    expect(result.placedPieces[0]).toMatchObject({
      id: 'Panel-0-0',
      sourceId: 'quote-piece-1',
    });
  });

  it('respeta rotación obligatoria, prohibida y veta por pieza', () => {
    const required = optimizeCuts({
      sheetWidth: 80,
      sheetHeight: 100,
      pieces: [{
        name: 'Rotada',
        width: 90,
        height: 70,
        quantity: 1,
        rotation: 'required',
      }],
    });
    const forbidden = optimizeCuts({
      sheetWidth: 80,
      sheetHeight: 100,
      pieces: [{
        name: 'Sin giro',
        width: 90,
        height: 70,
        quantity: 1,
        rotation: 'forbidden',
      }],
    });
    const grain = optimizeCuts({
      sheetWidth: 80,
      sheetHeight: 100,
      pieces: [{
        name: 'Con veta',
        width: 90,
        height: 70,
        quantity: 1,
        grainDirection: 'vertical',
      }],
    });

    expect(required.placedPieces[0]).toMatchObject({
      width: 70,
      height: 90,
      rotated: true,
    });
    expect(forbidden.unplacedPieces[0].reason).toBe('too-large');
    expect(grain.unplacedPieces[0].reason).toBe('too-large');
  });

  it('respeta márgenes sin alterar las dimensiones de la hoja', () => {
    const result = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0,
      margins: { top: 5, right: 10, bottom: 5, left: 10 },
      pieces: [{ name: 'Panel', width: 80, height: 70, quantity: 1 }],
    });

    expect(result.sheets[0]).toMatchObject({ width: 100, height: 80 });
    expect(result.placedPieces[0]).toMatchObject({ x: 10, y: 5 });
    expect(result.validation.isPhysicallyValid).toBe(true);
  });

  it('evita regiones bloqueadas y reservadas manteniendo el acomodo shelf', () => {
    const result = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0,
      blockedRegions: [{ id: 'damage', x: 0, y: 0, width: 30, height: 30 }],
      reservedRegions: [{ id: 'reserved', x: 60, y: 0, width: 20, height: 30 }],
      pieces: [{ name: 'Panel', width: 20, height: 20, quantity: 1 }],
    });

    expect(result.placedPieces[0]).toMatchObject({ x: 30, y: 0 });
    expect(result.validation.isPhysicallyValid).toBe(true);
  });

  it('nunca supera 100% de aprovechamiento ni genera merma negativa', () => {
    const result = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, kerf: 0, pieces: [{ name: 'A', width: 50, height: 50, quantity: 10 }] });
    expect(result.efficiencyPercent).toBeLessThanOrEqual(100);
    expect(result.totalWasteArea).toBeGreaterThanOrEqual(0);
    result.sheets.forEach((sheet) => {
      expect(sheet.efficiencyPercent).toBeLessThanOrEqual(100);
      expect(sheet.wasteArea).toBeGreaterThanOrEqual(0);
    });
  });

  it('no coloca piezas fuera de la hoja', () => {
    const result = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, pieces: [{ name: 'A', width: 60, height: 30, quantity: 5 }] });
    result.sheets.forEach((sheet) => {
      sheet.pieces.forEach((piece) => {
        expect(piece.x).toBeGreaterThanOrEqual(0);
        expect(piece.y).toBeGreaterThanOrEqual(0);
        expect(piece.x + piece.width).toBeLessThanOrEqual(sheet.width);
        expect(piece.y + piece.height).toBeLessThanOrEqual(sheet.height);
      });
    });
  });

  it('no encima piezas colocadas en la misma hoja', () => {
    const result = optimizeCuts({ sheetWidth: 122, sheetHeight: 244, pieces: [{ name: 'A', width: 60, height: 40, quantity: 8 }] });
    result.sheets.forEach((sheet) => {
      sheet.pieces.forEach((piece, index) => {
        sheet.pieces.slice(index + 1).forEach((next) => {
          const overlaps = piece.x < next.x + next.width
            && piece.x + piece.width > next.x
            && piece.y < next.y + next.height
            && piece.y + piece.height > next.y;
          expect(overlaps).toBe(false);
        });
      });
    });
  });

  it('envia piezas demasiado grandes a unplacedPieces', () => {
    const result = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, pieces: [{ name: 'Grande', width: 140, height: 120, quantity: 1 }] });
    expect(result.sheetCount).toBe(0);
    expect(result.unplacedPieces).toHaveLength(1);
    expect(result.unplacedPieces[0].name).toBe('Grande');
    expect(result.unplacedPieces[0].reason).toBe('too-large');
    expect(result.summary.requiredSheets).toBe(0);
    expect(result.purchasing.sheetsToBuy).toBe(0);
    expect(result.validation.isPhysicallyValid).toBe(false);
    expect(result.validation.warnings[0]).toContain('No cabe por tamaño físico');
  });

  it('la rotacion permite acomodar una pieza que sin rotacion no cabe', () => {
    const withoutRotation = optimizeCuts({ sheetWidth: 80, sheetHeight: 100, allowRotation: false, pieces: [{ name: 'Panel', width: 90, height: 70, quantity: 1 }] });
    const withRotation = optimizeCuts({ sheetWidth: 80, sheetHeight: 100, allowRotation: true, pieces: [{ name: 'Panel', width: 90, height: 70, quantity: 1 }] });
    expect(withoutRotation.unplacedPieces).toHaveLength(1);
    expect(withRotation.unplacedPieces).toHaveLength(0);
    expect(withRotation.sheets[0].pieces[0]).toMatchObject({ width: 70, height: 90, rotated: true });
  });

  it('crea hojas adicionales con multiples piezas cuando no caben', () => {
    const result = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, pieces: [{ name: 'A', width: 70, height: 70, quantity: 3 }] });
    expect(result.sheetCount).toBe(3);
    expect(result.sheets.every((sheet) => sheet.pieces.length === 1)).toBe(true);
  });

  it('respeta el kerf entre piezas', () => {
    const withoutKerf = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, kerf: 0, pieces: [{ name: 'A', width: 50, height: 100, quantity: 2 }] });
    const withKerf = optimizeCuts({ sheetWidth: 100, sheetHeight: 100, kerf: 0.3, pieces: [{ name: 'A', width: 50, height: 100, quantity: 2 }] });
    expect(withoutKerf.sheetCount).toBe(1);
    expect(withKerf.sheetCount).toBe(2);
  });
});
