import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HistorySection from '../HistorySection.jsx';

const quote = {
  id: 'q1', status: 'Aceptada', producto: 'Cocina', clienteNombre: 'Cliente',
  total: 1000, createdAt: Date.parse('2026-07-22T00:00:00Z'),
};

const baseProps = {
  history: [quote],
  money: (value) => String(value),
  updateHistoryStatus: vi.fn(),
  loadHistoryItem: vi.fn(),
  removeHistoryItem: vi.fn(),
  selectHistoryPreview: vi.fn(),
};

describe('autoridad de estado en Historial', () => {
  it('mantiene el selector comercial cuando no existe Producción', () => {
    const markup = renderToStaticMarkup(<HistorySection {...baseProps} />);
    expect(markup).toContain('<select');
    expect(markup).toContain('En revisión');
    expect(markup).not.toContain('En fabricación</option>');
  });

  it('bloquea degradaciones y conserva cancelación cuando existe Producción', () => {
    const markup = renderToStaticMarkup(<HistorySection
      {...baseProps}
      productionOrders={[{ id: 'ot1', quoteId: 'q1', estado: 'Fabricando' }]}
      purchases={[]}
    />);
    expect(markup).not.toContain('<select');
    expect(markup).toContain('En fabricación');
    expect(markup).toContain('Estado controlado por Producción');
    expect(markup).toContain('Abrir Producción');
    expect(markup).toContain('Cancelar proyecto');
  });

  it('abre el proyecto entregado sin permitir cancelarlo ni eliminarlo', () => {
    const markup = renderToStaticMarkup(<HistorySection
      {...baseProps}
      productionOrders={[{ id: 'ot1', quoteId: 'q1', estado: 'Entregado' }]}
      purchases={[]}
    />);
    expect(markup).toContain('Abrir Producción');
    expect(markup).toContain('>Abrir</button>');
    expect(markup).not.toContain('Cancelar proyecto');
    expect(markup).not.toContain('aria-label="Eliminar Cocina"');
  });
});
