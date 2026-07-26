import { describe, expect, it } from 'vitest';
import { normalizeCutInput } from '../normalization.js';
import {
  VALIDATION_CATEGORIES,
  VALIDATION_CODES,
  validateCutInput,
  validateOptimizationResult,
} from '../validation.js';

function validate(input) {
  return validateCutInput(input, normalizeCutInput(input));
}

function codes(result) {
  return result.errors.map((error) => error.code);
}

describe('cut optimizer input validation', () => {
  it('acepta una configuración física válida', () => {
    const result = validate({
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0.3,
      margins: { top: 1, right: 2, bottom: 3, left: 4 },
      pieces: [{ id: 'p1', name: 'Panel', width: 20, height: 30, quantity: 2 }],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('conserva cantidad legacy de uno cuando el campo está ausente', () => {
    const result = validate({
      sheetWidth: 100,
      sheetHeight: 80,
      pieces: [{ id: 'legacy', name: 'Panel', width: 20, height: 30 }],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('clasifica dimensiones de hoja y kerf inválidos', () => {
    const result = validate({
      sheetWidth: 0,
      sheetHeight: 'invalid',
      kerf: -0.3,
      pieces: [],
    });

    expect(codes(result)).toEqual(expect.arrayContaining([
      VALIDATION_CODES.SHEET_DIMENSIONS_INVALID,
      VALIDATION_CODES.KERF_INVALID,
    ]));
    expect(result.errors.every((error) => (
      error.category === VALIDATION_CATEGORIES.CONFIGURATION
    ))).toBe(true);
  });

  it('detecta márgenes negativos y físicamente imposibles', () => {
    const negative = validate({
      sheetWidth: 100,
      sheetHeight: 80,
      margins: { top: -1, right: 0, bottom: 0, left: 0 },
      pieces: [],
    });
    const impossible = validate({
      sheetWidth: 100,
      sheetHeight: 80,
      margins: { top: 0, right: 50, bottom: 0, left: 50 },
      pieces: [],
    });

    expect(codes(negative)).toContain(VALIDATION_CODES.MARGIN_INVALID);
    expect(codes(impossible)).toContain(VALIDATION_CODES.MARGINS_EXCEED_SHEET);
  });

  it('detecta dimensiones y cantidades de pieza inválidas conservando sourceId', () => {
    const result = validate({
      sheetWidth: 100,
      sheetHeight: 80,
      pieces: [{
        id: 'quote-piece',
        name: 'Panel',
        width: -10,
        height: 'invalid',
        quantity: 1.5,
      }],
    });

    expect(codes(result)).toEqual(expect.arrayContaining([
      VALIDATION_CODES.PIECE_DIMENSIONS_INVALID,
      VALIDATION_CODES.PIECE_QUANTITY_INVALID,
    ]));
    expect(result.errors.find((error) => (
      error.code === VALIDATION_CODES.PIECE_DIMENSIONS_INVALID
    )).sourceId).toBe('quote-piece');
  });

  it('clasifica regiones inválidas y fuera de la hoja', () => {
    const invalidCollection = validate({
      sheetWidth: 100,
      sheetHeight: 80,
      blockedRegions: {},
      pieces: [],
    });
    const invalidRegions = validate({
      sheetWidth: 100,
      sheetHeight: 80,
      blockedRegions: [{ id: 'bad', x: -1, y: 0, width: 10, height: 10 }],
      reservedRegions: [{ id: 'outside', x: 95, y: 0, width: 10, height: 10 }],
      pieces: [],
    });

    expect(codes(invalidCollection)).toContain(VALIDATION_CODES.REGIONS_INVALID);
    expect(codes(invalidRegions)).toEqual(expect.arrayContaining([
      VALIDATION_CODES.REGION_INVALID,
      VALIDATION_CODES.REGION_OUT_OF_BOUNDS,
    ]));
  });

  it('detecta restricciones de rotación inválidas o incoherentes', () => {
    const result = validate({
      sheetWidth: 100,
      sheetHeight: 100,
      allowRotation: false,
      pieces: [
        {
          id: 'invalid',
          name: 'Inválida',
          width: 20,
          height: 30,
          quantity: 1,
          rotation: 'sometimes',
        },
        {
          id: 'conflict',
          name: 'Conflicto',
          width: 20,
          height: 30,
          quantity: 1,
          rotation: 'required',
          grainDirection: 'vertical',
        },
      ],
    });

    expect(codes(result)).toEqual(expect.arrayContaining([
      VALIDATION_CODES.ROTATION_INVALID,
      VALIDATION_CODES.ROTATION_CONFLICT,
    ]));
  });

  it('advierte que la veta restringe rotación y detecta una pieza que no cabe', () => {
    const result = validate({
      sheetWidth: 80,
      sheetHeight: 100,
      pieces: [{
        id: 'grain-piece',
        name: 'Puerta',
        width: 90,
        height: 70,
        quantity: 1,
        grainDirection: 'vertical',
      }],
    });

    expect(codes(result)).toContain(VALIDATION_CODES.PIECE_DOES_NOT_FIT);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: VALIDATION_CODES.GRAIN_RESTRICTS_ROTATION,
        sourceId: 'grain-piece',
      }),
    ]);
  });
});

describe('cut optimizer result validation', () => {
  it('conserva warnings legacy y añade diagnósticos estructurados', () => {
    const inputValidation = {
      isValid: false,
      errors: [{
        code: VALIDATION_CODES.KERF_INVALID,
        category: VALIDATION_CATEGORIES.CONFIGURATION,
        message: 'El kerf es inválido.',
      }],
      warnings: [],
      diagnostics: [],
    };
    const result = validateOptimizationResult({
      sheets: [{
        pieces: [
          { name: 'A', x: 0, y: 0, width: 50, height: 50 },
          { name: 'B', x: 49, y: 0, width: 20, height: 20 },
        ],
      }],
      config: {
        sheetWidth: 100,
        sheetHeight: 80,
        kerf: 0.3,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        blockedRegions: [],
        reservedRegions: [],
      },
      inputValidation,
    });

    expect(result.isPhysicallyValid).toBe(false);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'Piezas sobrepuestas: A / B.',
      'El kerf es inválido.',
    ]));
    expect(result.errors).toEqual(expect.arrayContaining([
      inputValidation.errors[0],
      expect.objectContaining({ code: VALIDATION_CODES.PIECE_COLLISION }),
    ]));
    expect(result.input).toBe(inputValidation);
  });

  it('detecta piezas dentro de regiones bloqueadas y reservadas', () => {
    const result = validateOptimizationResult({
      sheets: [{
        pieces: [
          { name: 'Bloqueada', x: 10, y: 10, width: 20, height: 20 },
          { name: 'Reservada', x: 50, y: 10, width: 20, height: 20 },
        ],
      }],
      config: {
        sheetWidth: 100,
        sheetHeight: 80,
        kerf: 0,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        blockedRegions: [{ x: 15, y: 15, width: 5, height: 5 }],
        reservedRegions: [{ x: 55, y: 15, width: 5, height: 5 }],
      },
      inputValidation: { errors: [], warnings: [] },
    });

    expect(result.warnings).toEqual(expect.arrayContaining([
      'Pieza dentro de zona bloqueada: Bloqueada.',
      'Pieza dentro de zona reservada: Reservada.',
    ]));
    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      VALIDATION_CODES.BLOCKED_REGION_COLLISION,
      VALIDATION_CODES.RESERVED_REGION_COLLISION,
    ]));
  });
});
