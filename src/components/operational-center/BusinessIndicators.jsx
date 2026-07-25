export default function BusinessIndicators({ indicators = {}, money }) {
  const items = [
    ['Ventas entregadas', indicators.sales, true],
    ['Costo', indicators.cost, true],
    ['Utilidad', indicators.profit, true],
    ['Avance de compras', indicators.progress, false],
  ];

  return (
    <section className="operational-indicators" aria-label="Indicadores del negocio">
      {items.map(([label, indicator, monetary]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>
            {indicator?.status === 'available'
              ? label === 'Ventas entregadas' && !indicator.value
                ? 'No hay ventas entregadas'
                : monetary ? money(indicator.value) : `${Math.round(indicator.value || 0)}%`
              : 'Sin información'}
          </strong>
          <small>
            {label === 'Ventas entregadas' && indicators.deliveredProjects?.status === 'available'
              ? `${indicators.deliveredProjects.value} ${
                indicators.deliveredProjects.value === 1
                  ? 'proyecto entregado'
                  : 'proyectos entregados'
              }`
              : indicator?.source || 'Fuente no disponible'}
          </small>
        </div>
      ))}
    </section>
  );
}
