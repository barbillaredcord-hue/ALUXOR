import { useEffect, useMemo } from 'react';
import {
  Accessibility,
  Archive,
  Calculator,
  ClipboardList,
  DoorOpen,
  FileText,
  Hammer,
  History,
  LayoutDashboard,
  Package,
  Scissors,
  Sparkles,
  Store,
  TableProperties,
  UserCheck,
} from 'lucide-react';

import { canAccessSection } from '../lib/workspace/permissions.js';
export default function useNavigation({
  activeSection,
  setActiveSection,
  currentWorkspaceRole,
  canManageWorkspaceAccess,
}) {
  // Aquí moveremos menuItems
const menuItems = useMemo(() => {
  const items = [
    { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
    { id: 'anuncio', label: 'Anuncio', icon: Package },
    { id: 'cotizador-rellenado', label: 'Cotizador rellenado', icon: FileText },
    { id: 'cotizador', label: 'Cotizador', icon: Calculator },
    { id: 'produccion', label: 'Producción', icon: ClipboardList },
    { id: 'compras', label: 'Compras', icon: Store },
    { id: 'recepcion', label: 'Recepción', icon: DoorOpen },
    { id: 'inventario', label: 'Inventario', icon: Archive },
    { id: 'fabricacion', label: 'Fabricación', icon: Hammer },
    { id: 'corte', label: 'Cut Optimizer', icon: Scissors },
    { id: 'catalogo', label: 'Catálogo', icon: TableProperties },
    { id: 'historial', label: 'Historial', icon: History },
    { id: 'textos', label: 'Textos', icon: Sparkles },
    { id: 'ajustes', label: 'Ajustes', icon: Accessibility },
  ].filter((item) => canAccessSection(currentWorkspaceRole, item.id));

  if (canManageWorkspaceAccess) {
    items.push({
      id: 'solicitudes-acceso',
      label: 'Solicitudes',
      icon: UserCheck,
    });
  }

  return items;
}, [currentWorkspaceRole, canManageWorkspaceAccess]);

  // Aquí moveremos el useEffect que valida la sección activa
  useEffect(() => {
  const allowed =
    activeSection === 'solicitudes-acceso'
      ? canManageWorkspaceAccess
      : canAccessSection(currentWorkspaceRole, activeSection);

  if (currentWorkspaceRole && !allowed) {
    setActiveSection('inicio');
  }
}, [
  activeSection,
  canManageWorkspaceAccess,
  currentWorkspaceRole,
  setActiveSection,
]);

  return {
    menuItems,
  };
}