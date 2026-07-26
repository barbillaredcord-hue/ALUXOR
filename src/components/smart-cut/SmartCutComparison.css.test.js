import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  new URL('../../styles/smart-cut.css', import.meta.url),
  'utf8',
);

describe('Smart Cut responsive y accesible', () => {
  it('define adaptación para tablet y móvil sin mínimos rígidos', () => {
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 680px)');
    expect(css).toContain('container-type: inline-size');
    expect(css).toContain('@container (max-width: 700px)');
    expect(css).toContain('@container (max-width: 420px)');
    expect(css).toContain('minmax(min(100%, 280px), 1fr)');
    expect(css).toContain('min-width: 0');
  });

  it('mantiene foco visible y respeta movimiento reducido', () => {
    expect(css).toContain('.smart-cut-candidate-card:focus-visible');
    expect(css).toContain('outline: 3px solid var(--br-focus-ring)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
