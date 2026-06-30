import { describe, expect, it } from 'vitest';
import { optimizeCuts } from '../optimizer.js';

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
