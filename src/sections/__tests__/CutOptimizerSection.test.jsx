import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CutOptimizerSection from '../CutOptimizerSection.jsx';

describe('CutOptimizerSection calculator transfer', () => {
  it('optimiza únicamente las piezas enviadas por la calculadora', () => {
    const markup = renderToStaticMarkup(
      <CutOptimizerSection
        quote={{
          measureRows: [
            { id: 'selected', nombre: 'Puerta', ancho: 40, alto: 70, cantidad: 1 },
            { id: 'excluded', nombre: 'Respaldo', ancho: 100, alto: 100, cantidad: 4 },
          ],
          materialRows: [],
        }}
        calculatorTransfer={{
          quoteId: 'q1',
          selectedPieceIds: ['selected'],
          material: { id: 'm1', nombre: 'Melamina' },
          config: {
            unit: 'cm',
            formatWidth: 122,
            formatHeight: 244,
            kerf: 0.3,
            allowRotation: true,
          },
        }}
        contextQuoteId="q1"
        decimal={(value) => String(value)}
      />,
    );

    expect(markup).toContain('Calculando únicamente 1 pieza(s)');
    expect(markup).toContain('Abrir BR Material Studio');
    expect(markup).toContain('Puerta');
    expect(markup).not.toContain('Respaldo');
  });
});
