import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MaterialCalculator, {
  buildTechnicalPieceLayout,
  groupPiecesByCategory,
  inferPieceCategory,
  pieceQuantityTotal,
  TechnicalPieceBoard,
} from './MaterialCalculator.jsx';

const context = {
  quoteId: 'q1',
  projectId: 'ot1',
  projectName: 'Cocina Dora',
  customerName: 'Dora',
};
const pieces = [{
  id: 'p1',
  nombre: 'Costado izquierdo',
  groupId: 'g1',
  ancho: 55,
  alto: 72,
  cantidad: 1,
  materialAssignments: [{ materialId: 'm1' }],
}];
const groups = [{ id: 'g1', name: 'Mueble bajo fregadero' }];
const materials = [{ id: 'm1', nombre: 'Melamina nogal' }];

describe('MaterialCalculator', () => {
  it('renderiza el workspace profesional por áreas sin apariencia de wizard', () => {
    const markup = renderToStaticMarkup(
      <MaterialCalculator
        context={context}
        pieces={pieces}
        pieceGroups={groups}
        materials={materials}
        initialSelectedPieceIds={['p1']}
      />,
    );

    expect(markup).toContain('BR Material Studio');
    expect(markup).toContain('Volver a Cotización');
    expect(markup).toContain('Guía rápida');
    expect(markup).toContain('Modo rápido');
    expect(markup).toContain('Modo por proyecto');
    expect(markup).toContain('Tipo de cálculo');
    expect(markup).toContain('Proyecto y conjuntos');
    expect(markup).toContain('Material y configuración');
    expect(markup).toContain('Piezas y medidas');
    expect(markup).toContain('Resultado y acciones');
    expect(markup).not.toContain('Paso 1');
    expect(markup).toContain('Mueble bajo fregadero');
    expect(markup).toContain('Costado izquierdo');
    expect(markup).toContain('Aplicar a Cotización');
    expect(markup).toContain('Optimizar cortes');
    expect(markup).toContain('No hay un cálculo todavía');
    expect(markup).toContain('Cómo se forma el resultado');
    expect(markup).toContain('Sin calcular');
    expect(markup).toContain('role="table"');
    expect(markup).toContain('aria-label="Piezas incluidas en el cálculo"');
    expect(markup).toContain('aria-label="Cadena del cálculo"');
    expect(markup).toContain('Editar');
    expect(markup).toContain('Vista conceptual de piezas');
    expect(markup).toContain('aria-controls="calculator-material-editor"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Guardar selección temporal');
    expect(markup).toContain('1 pieza(s) seleccionada(s)');
  });

  it('conserva el modo rápido independiente usando el mismo componente', () => {
    const markup = renderToStaticMarkup(
      <MaterialCalculator initialMode="quick" />,
    );

    expect(markup).toContain('Cálculo independiente');
    expect(markup).toContain('Pieza independiente');
    expect(markup).not.toContain('Esta cotización todavía no tiene conjuntos');
  });

  it('muestra estados vacíos para conjuntos, piezas y materiales', () => {
    const markup = renderToStaticMarkup(
      <MaterialCalculator context={context} pieces={[]} pieceGroups={[]} materials={[]} />,
    );

    expect(markup).toContain('Esta cotización todavía no tiene conjuntos');
    expect(markup).toContain('Este conjunto no tiene piezas');
    expect(markup).toContain('No hay materiales disponibles');
    expect(markup).toContain('Selecciona al menos una pieza');
  });
});

describe('jerarquía y vista técnica', () => {
  it('deriva categorías únicamente desde datos explícitos o nombres seguros', () => {
    expect(inferPieceCategory({ nombre: 'Puerta izquierda' })).toBe('Puertas');
    expect(inferPieceCategory({ nombre: 'Costado derecho' })).toBe('Estructura');
    expect(inferPieceCategory({ nombre: 'Entrepaño 1' })).toBe('Interiores');
    expect(inferPieceCategory({ nombre: 'Pieza especial' })).toBeNull();
    expect(inferPieceCategory({ nombre: 'Pieza especial', categoria: 'Remates' })).toBe('Remates');
  });

  it('mantiene piezas no clasificables directamente dentro del conjunto', () => {
    const organization = groupPiecesByCategory([
      { id: 'door', nombre: 'Puerta', cantidad: 2 },
      { id: 'special', nombre: 'Pieza especial', cantidad: 3 },
    ]);

    expect(organization.categories).toEqual([
      { name: 'Puertas', pieces: [{ id: 'door', nombre: 'Puerta', cantidad: 2 }] },
    ]);
    expect(organization.direct).toEqual([
      { id: 'special', nombre: 'Pieza especial', cantidad: 3 },
    ]);
    expect(pieceQuantityTotal([...organization.categories[0].pieces, ...organization.direct])).toBe(5);
  });

  it('representa dimensiones reales y selección sin inventar una forma de mueble', () => {
    const technicalPieces = [
      { id: 'wide', nombre: 'Piso', ancho: 100, alto: 25 },
      { id: 'tall', nombre: 'Costado', ancho: 30, alto: 90 },
    ];
    const layout = buildTechnicalPieceLayout(technicalPieces, ['tall']);
    const markup = renderToStaticMarkup(
      <TechnicalPieceBoard pieces={technicalPieces} selectedPieceIds={['tall']} />,
    );

    expect(layout.find((piece) => piece.id === 'tall').selected).toBe(true);
    expect(layout.find((piece) => piece.id === 'wide').width)
      .toBeGreaterThan(layout.find((piece) => piece.id === 'wide').height);
    expect(markup).toContain('Tablero técnico de piezas reales');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('no representa un mueble');
    expect(markup).not.toContain('3D');
  });
});
