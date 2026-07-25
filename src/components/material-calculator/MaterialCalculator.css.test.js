import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  new URL('../../styles/material-calculator.css', import.meta.url),
  'utf8',
);

describe('responsive de BR Material Studio', () => {
  it('define tres zonas amplias sin escalar el workspace', () => {
    expect(css).toContain('grid-template-columns: minmax(190px, 220px) minmax(480px, 1fr) minmax(270px, 310px)');
    expect(css).not.toContain('transform: scale(');
  });

  it('adapta laptop, tablet y móvil sin ancho mínimo horizontal en piezas', () => {
    expect(css).toContain('@media (max-width: 1380px)');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 680px)');
    expect(css).toContain('min-width: 0;');
    expect(css).not.toMatch(/min-width:\s*(9[0-9]{2}|[1-9][0-9]{3,})px/);
  });

  it('mantiene resultado y acciones accesibles mediante sticky seguro', () => {
    expect(css).toMatch(/\.calculator-step--result\s*\{[^}]*position:\s*sticky/s);
    expect(css).toMatch(/\.calculator-actions\s*\{[^}]*position:\s*sticky/s);
  });

  it('incluye ficha plegable, jerarquía y tablero técnico accesible', () => {
    expect(css).toContain('.calculator-material-editor[hidden]');
    expect(css).toContain('.calculator-piece-category');
    expect(css).toContain('.technical-piece-board');
    expect(css).toContain('.technical-piece:focus-visible rect');
  });
});
