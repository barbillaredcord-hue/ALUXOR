import { useState } from 'react';
import {
  Boxes,
  ClipboardList,
  Factory,
  FileClock,
  PackageCheck,
  PackageOpen,
  ShoppingCart,
} from 'lucide-react';
import BusinessIndicators from '../components/operational-center/BusinessIndicators.jsx';
import DashboardActivity from '../components/operational-center/DashboardActivity.jsx';
import ExpandableDashboardCard from '../components/operational-center/ExpandableDashboardCard.jsx';
import FocusCard from '../components/operational-center/FocusCard.jsx';
import FocusSelector from '../components/operational-center/FocusSelector.jsx';

function metric(label, value) {
  return (
    <div className="operational-card-metric">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </div>
  );
}

export default function DashboardSection({
  businessState,
  selectedProjectId,
  onSelectProject,
  money,
  onOpenProject,
  onOpenSection,
}) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const projects = businessState?.projects || [];
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
    || projects[0]
    || null;
  const summaries = businessState?.summaries || {};
  const quotes = summaries.quotes || {};
  const production = summaries.production || {};
  const purchases = summaries.purchases || {};
  const receptions = summaries.receptions || {};
  const purchaseOperations = summaries.purchaseOperations || {};
  const inventory = summaries.inventory || {};
  const fabrication = summaries.fabrication || {};
  const history = summaries.history || {};

  const selector = (
    <FocusSelector
      projects={projects}
      selectedId={selectedProject?.id || null}
      open={selectorOpen}
      onToggle={() => setSelectorOpen((current) => !current)}
      onSelect={(projectId) => {
        onSelectProject(projectId);
        setSelectorOpen(false);
      }}
    />
  );

  const cards = [
    {
      id: 'cotizador',
      title: 'Cotizaciones',
      icon: ClipboardList,
      tone: 'aluminum',
      value: quotes.total || 0,
      detail: `${quotes.pending || 0} pendientes · ${quotes.accepted || 0} aceptadas`,
      content: (
        <>
          {metric('Pendientes', quotes.pending)}
          {metric('En aprobación', quotes.inReview)}
          {metric('Ventas entregadas', money(businessState?.indicators?.sales?.value || 0))}
          {metric('Utilidad', money(businessState?.indicators?.profit?.value || 0))}
        </>
      ),
      label: 'Ir a Cotizaciones',
    },
    {
      id: 'produccion',
      title: 'Producción',
      icon: Factory,
      tone: 'graphite',
      value: production.active || 0,
      detail: production.active
        ? `${production.inProcess || 0} en proceso · ${production.pending || 0} pendientes`
        : 'No hay órdenes en producción',
      content: (
        <>
          {metric('Órdenes activas', production.active)}
          {metric('OT pendientes', production.pending)}
          {metric('En fabricación', businessState?.workflow?.fabricating)}
          {metric('Entregadas', production.delivered)}
        </>
      ),
      label: 'Ir a Producción',
    },
    {
      id: 'compras',
      title: 'Compras',
      icon: ShoppingCart,
      tone: 'wood',
      value: purchaseOperations.activePurchasesCount || 0,
      detail: `${purchases.pending || 0} partidas pendientes`,
      content: (
        <>
          {metric('Pendientes', purchases.pending)}
          {metric('Urgentes / vencidas', purchaseOperations.overduePurchasesCount)}
          {metric('Por recibir', purchases.purchased)}
          {metric('Última compra', purchases.updatedAt || 'Sin fecha')}
        </>
      ),
      label: 'Ir a Compras',
    },
    {
      id: 'recepcion',
      title: 'Recepción',
      icon: PackageOpen,
      tone: 'aluminum',
      value: receptions.receptions || 0,
      detail: `${receptions.pendingItems || 0} pendientes · ${receptions.partialItems || 0} parciales`,
      content: (
        <>
          {metric('Partidas completas', receptions.completeItems)}
          {metric('Incidencias', receptions.incidentItems)}
          {metric('Actividad reciente', receptions.recentReceptions)}
          {metric('Última recepción', receptions.updatedAt || 'Sin fecha')}
        </>
      ),
      label: 'Ir a Recepción',
    },
    {
      id: 'inventario',
      title: 'Inventario',
      icon: Boxes,
      tone: 'glass',
      value: inventory.total || 0,
      detail: `${inventory.available || 0} disponibles · ${inventory.missing || 0} faltantes`,
      content: (
        <>
          {metric('Disponibles', inventory.available)}
          {metric('Stock bajo', inventory.lowStock)}
          {metric('Faltantes', inventory.outOfStock)}
          {metric('Última actualización', inventory.updatedAt || 'Sin fecha')}
        </>
      ),
      label: 'Ir a Inventario',
    },
    {
      id: 'fabricacion',
      title: 'Fabricación',
      icon: PackageCheck,
      tone: 'aluminum',
      value: fabrication.projects || 0,
      detail: `${fabrication.pieces || 0} piezas · ${fabrication.materials || 0} materiales`,
      content: (
        <>
          {metric('Proyectos', fabrication.projects)}
          {metric('Piezas colocadas', fabrication.placedPieces)}
          {metric('Pendientes de optimizar', fabrication.pendingOptimization)}
          {metric('Planes por revisar', fabrication.invalidPlans)}
        </>
      ),
      label: 'Ir a Fabricación',
    },
    {
      id: 'historial',
      title: 'Historial',
      icon: FileClock,
      tone: 'graphite',
      value: history.records || 0,
      detail: `${history.completed || 0} terminados · ${history.cancelled || 0} cancelados`,
      content: (
        <>
          {metric('Registros', history.records)}
          {metric('Aceptados', history.accepted)}
          {metric('Terminados', history.completed)}
          {metric('Última actualización', history.updatedAt || 'Sin fecha')}
        </>
      ),
      label: 'Ir a Historial',
    },
  ];

  return (
    <section className="operational-center">
      <FocusCard
        project={selectedProject}
        onOpenProject={onOpenProject}
        selector={selector}
      />

      <BusinessIndicators indicators={businessState?.indicators} money={money} />

      <div className="operational-dashboard-grid">
        {cards.map((card) => (
          <ExpandableDashboardCard
            key={card.id}
            {...card}
            expanded={expandedCardId === card.id}
            onToggle={() => setExpandedCardId((current) => (
              current === card.id ? null : card.id
            ))}
            onOpen={() => onOpenSection(card.id, selectedProject)}
            openLabel={card.label}
          >
            {card.content}
          </ExpandableDashboardCard>
        ))}
      </div>

      <DashboardActivity
        activity={businessState?.activity}
        onOpen={(event) => {
          const project = projects.find((item) => item.id === event.projectId) || null;
          if (project) onSelectProject(project.id);
          onOpenSection(event.destination, project);
        }}
      />
    </section>
  );
}
