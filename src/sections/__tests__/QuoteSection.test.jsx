import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MaterialStudioLauncher,
  QuoteStatusControl,
} from '../QuoteSection.jsx';

describe('autoridad del estado en Cotización', () => {
  it('mantiene editable únicamente el estado comercial antes de Producción', () => {
    const markup = renderToStaticMarkup(<QuoteStatusControl
      value="En revisión"
      displayStatus="En revisión"
    />);

    expect(markup).toContain('<select');
    expect(markup).toContain('Borrador');
    expect(markup).toContain('En revisión');
    expect(markup).not.toContain('En fabricación</option>');
    expect(markup).not.toContain('Instalación</option>');
    expect(markup).not.toContain('Terminada</option>');
  });

  it('reemplaza el selector cuando Producción toma autoridad', () => {
    const markup = renderToStaticMarkup(<QuoteStatusControl
      value="Aceptada"
      displayStatus="En fabricación"
      locked
    />);

    expect(markup).not.toContain('<select');
    expect(markup).toContain('En fabricación');
    expect(markup).toContain('Estado controlado por Producción');
    expect(markup).toContain('Abrir Producción');
    expect(markup).toContain('Cancelar proyecto');
  });

  it('conserva acceso a Producción y oculta cancelar cuando está entregado', () => {
    const markup = renderToStaticMarkup(<QuoteStatusControl
      value="Aceptada"
      displayStatus="Terminada"
      locked
      readOnly
    />);
    expect(markup).toContain('Abrir Producción');
    expect(markup).not.toContain('Cancelar proyecto');
  });
});

describe('acceso a BR Material Studio', () => {
  it('deja en Cotización únicamente el acceso al workspace dedicado', () => {
    const markup = renderToStaticMarkup(<MaterialStudioLauncher />);

    expect(markup).toContain('BR Material Studio');
    expect(markup).toContain('Selecciona piezas, calcula materiales y optimiza cortes.');
    expect(markup).toContain('03');
    expect(markup).not.toContain('Modo por proyecto');
    expect(markup).not.toContain('Resultado y acciones');
  });
});
