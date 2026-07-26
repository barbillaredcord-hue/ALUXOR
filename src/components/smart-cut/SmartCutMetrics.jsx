import { Boxes, ChartNoAxesCombined, PackageCheck, PackageX, SquareDashed } from 'lucide-react';

function display(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sin dato';
  return number.toLocaleString('es-MX', { maximumFractionDigits: digits });
}

export default function SmartCutMetrics({ candidate }) {
  const summary = candidate?.summary || {};
  const metrics = [
    { label: 'Hojas requeridas', value: summary.requiredSheets ?? '—', icon: Boxes },
    { label: 'Aprovechamiento', value: `${display(summary.utilization)}%`, icon: ChartNoAxesCombined },
    { label: 'Desperdicio físico', value: `${display(summary.wasteArea)} u²`, icon: SquareDashed },
    { label: 'Piezas colocadas', value: summary.placedPieceCount ?? candidate?.placedPieces?.length ?? '—', icon: PackageCheck },
    { label: 'Piezas no colocadas', value: summary.unplacedPieceCount ?? candidate?.unplacedPieces?.length ?? '—', icon: PackageX },
  ];

  return (
    <section className="smart-cut-metrics" aria-labelledby="smart-cut-metrics-title">
      <h4 id="smart-cut-metrics-title">Métricas físicas</h4>
      <div>
        {metrics.map(({ label, value, icon: Icon }) => (
          <article key={label}>
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
