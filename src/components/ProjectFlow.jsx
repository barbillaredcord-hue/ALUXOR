import {
  Archive,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  Factory,
  FileText,
  Hammer,
  PackageCheck,
  ShoppingCart,
} from 'lucide-react';

const stages = [
  { id: 'cotizacion', section: 'cotizador', label: 'Cotización', icon: FileText },
  { id: 'produccion', section: 'produccion', label: 'Producción', icon: ClipboardList },
  { id: 'compras', section: 'compras', label: 'Compras', icon: ShoppingCart },
  { id: 'recepcion', section: 'recepcion', label: 'Recepción', icon: PackageCheck },
  { id: 'inventario', section: 'inventario', label: 'Inventario', icon: Archive },
  { id: 'fabricacion', section: 'fabricacion', label: 'Fabricación', icon: Factory },
  { id: 'instalacion', section: 'instalacion', label: 'Instalación', icon: Hammer },
  { id: 'entrega', section: 'entrega', label: 'Entrega', icon: DoorOpen },
];

export default function ProjectFlow({ activeSection }) {
  const activeIndex = Math.max(0, stages.findIndex((stage) => stage.section === activeSection));

  return (
    <nav className="project-flow" aria-label="Flujo del proyecto">
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const state = index < activeIndex ? 'completado' : index === activeIndex ? 'en-proceso' : 'pendiente';
        const label = index < activeIndex ? 'Completado' : index === activeIndex ? 'En proceso' : 'Pendiente';
        return (
          <article key={stage.id} className={`project-flow-step project-flow-${state}`}>
            <div className="project-flow-icon">
              {state === 'completado' ? <CheckCircle2 size={18} /> : <Icon size={18} />}
            </div>
            <div>
              <strong>{stage.label}</strong>
              <span>{label}</span>
            </div>
          </article>
        );
      })}
    </nav>
  );
}
