import { describe, expect, it } from 'vitest';
import {
  expandCutPieces,
  normalizeCutConfig,
  normalizeCutInput,
  normalizeMargins,
  normalizePieceRestrictions,
  normalizeRegions,
} from '../normalization.js';

describe('cut optimizer normalization', () => {
  it('conserva propiedades legacy y adicionales de config sin mutar la entrada', () => {
    const input = Object.freeze({
      anchoHoja: 100,
      altoHoja: 80,
      kerf: 0.2,
      allowRotation: false,
      strategy: 'input-order',
      customOption: 'preserved',
    });

    const config = normalizeCutConfig(input);

    expect(config).toMatchObject({
      anchoHoja: 100,
      altoHoja: 80,
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0.2,
      allowRotation: false,
      strategy: 'input-order',
      customOption: 'preserved',
    });
    expect(input).toEqual({
      anchoHoja: 100,
      altoHoja: 80,
      kerf: 0.2,
      allowRotation: false,
      strategy: 'input-order',
      customOption: 'preserved',
    });
  });

  it('expande cantidades con IDs legacy deterministas y sourceId aditivo', () => {
    const pieces = [{
      id: 'quote-piece-1',
      nombre: 'Costado',
      ancho: 40,
      alto: 70,
      cantidad: 2,
    }];

    const expanded = expandCutPieces(pieces);

    expect(expanded).toHaveLength(2);
    expect(expanded.map((piece) => piece.id)).toEqual(['Costado-0-0', 'Costado-0-1']);
    expect(expanded.map((piece) => piece.sourceId)).toEqual([
      'quote-piece-1',
      'quote-piece-1',
    ]);
    expect(expanded.map((piece) => piece.index)).toEqual([1, 2]);
    expect(expanded.every((piece) => piece.quantity === 2)).toBe(true);
    expect(pieces[0]).not.toHaveProperty('sourceId');
  });

  it('omite sourceId cuando la pieza original no tiene identificador', () => {
    const [piece] = expandCutPieces([{
      name: 'Panel',
      width: 20,
      height: 30,
      quantity: 1,
    }]);

    expect(piece.id).toBe('Panel-0-0');
    expect(piece).not.toHaveProperty('sourceId');
  });

  it('normaliza restricciones opcionales de rotación, veta y prioridad', () => {
    expect(normalizePieceRestrictions({})).toMatchObject({
      rotation: 'allowed',
      allowRotation: true,
      rotationRequired: false,
      grainRestricted: false,
      priority: 0,
    });
    expect(normalizePieceRestrictions({ allowRotation: false }).rotation).toBe('forbidden');
    expect(normalizePieceRestrictions({ rotation: 'required' })).toMatchObject({
      rotation: 'required',
      rotationRequired: true,
    });
    expect(normalizePieceRestrictions({ grainDirection: 'vertical' })).toMatchObject({
      rotation: 'forbidden',
      grainDirection: 'vertical',
      grainRestricted: true,
    });
    expect(normalizePieceRestrictions({ prioridad: 4 }).priority).toBe(4);
  });

  it('normaliza márgenes simétricos, por lado y aliases en español', () => {
    expect(normalizeMargins(2)).toEqual({
      top: 2,
      right: 2,
      bottom: 2,
      left: 2,
    });
    expect(normalizeMargins({
      superior: 1,
      derecho: 2,
      inferior: 3,
      izquierdo: 4,
    })).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4,
    });
  });

  it('normaliza regiones sin alterar dimensiones ni IDs de origen', () => {
    const input = [{
      id: 'damage-1',
      x: 5,
      y: 6,
      ancho: 20,
      alto: 10,
    }];

    expect(normalizeRegions(input, 'blocked')).toEqual([{
      id: 'blocked-region-1',
      sourceId: 'damage-1',
      kind: 'blocked',
      x: 5,
      y: 6,
      width: 20,
      height: 10,
    }]);
    expect(input[0]).not.toHaveProperty('width');
  });

  it('produce la misma normalización para la misma entrada', () => {
    const input = {
      sheetWidth: 100,
      sheetHeight: 80,
      margins: { top: 1, right: 2, bottom: 3, left: 4 },
      pieces: [{ id: 'p1', name: 'Panel', width: 20, height: 30, quantity: 2 }],
    };

    expect(normalizeCutInput(input)).toEqual(normalizeCutInput(input));
  });
});
