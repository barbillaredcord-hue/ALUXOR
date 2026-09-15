import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ExpandableDashboardCard from './ExpandableDashboardCard.jsx';

const styles = readFileSync(new URL('../../styles/operational-center.css', import.meta.url), 'utf8');

describe('tarjetas expandibles del Dashboard', () => {
  it('permite scroll interno solo al expandirse', () => {
    expect(styles).toContain('max-height: min(320px, 48vh)');
    expect(styles).toContain('overflow-y: auto');
    expect(styles).toContain('overflow-x: hidden');
  });

  it('mantiene el botón de navegación accesible', () => {
    const markup = renderToStaticMarkup(
      <ExpandableDashboardCard
        icon={() => null}
        title="Producción"
        value={1}
        detail="Detalle"
        expanded
        onToggle={() => {}}
        onOpen={() => {}}
        openLabel="Ir a Producción"
      >
        <p>Contenido largo</p>
      </ExpandableDashboardCard>,
    );
    expect(markup).toContain('Ir a Producción');
    expect(markup).not.toContain('tabindex="-1"');
  });
});
