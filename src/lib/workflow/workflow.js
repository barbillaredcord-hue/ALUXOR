export const WORKFLOW_STAGES = [
  'Cotización',
  'Producción',
  'Compras',
  'Recepción',
  'Inventario',
  'Fabricación',
  'Control de calidad',
  'Instalación',
  'Entrega',
  'Garantía',
];

function hasItems(items = []) {
  return Array.isArray(items) && items.length > 0;
}

function isCompleteList(items = []) {
  return hasItems(items) && items.every((item) => item?.status === 'completado' || item?.status === 'recibido' || item?.status === true);
}

export function getProjectStage({ quote = {}, workflow = {} } = {}) {
  if (workflow.proyectoCerrado) return 'Garantía';
  if (workflow.entregaFirmada) return 'Garantía';
  if (workflow.instalacionTerminada) return 'Entrega';
  if (workflow.controlAprobado) return 'Instalación';
  if (workflow.fabricacionChecklist === 100) return 'Control de calidad';
  if (workflow.inventarioCompleto) return 'Fabricación';
  if (isCompleteList(workflow.recepcionItems)) return 'Inventario';
  if (isCompleteList(workflow.compraItems)) return 'Recepción';
  if (Number(quote.deposit || 0) > 0) return 'Producción';
  return 'Cotización';
}

export function getAvailableActions({ quote = {}, workflow = {} } = {}) {
  const actions = ['Revisar cotización'];
  if (Number(quote.deposit || 0) > 0) actions.push('Crear orden de producción');
  if (hasItems(quote.materialRows)) actions.push('Preparar compras');
  if (isCompleteList(workflow.compraItems)) actions.push('Recibir materiales');
  if (isCompleteList(workflow.recepcionItems)) actions.push('Actualizar inventario');
  if (workflow.inventarioCompleto) actions.push('Iniciar fabricación');
  if (workflow.fabricacionChecklist === 100) actions.push('Control de calidad');
  if (workflow.controlAprobado) actions.push('Programar instalación');
  return actions;
}

export function getWarnings({ form = {}, quote = {}, workflow = {} } = {}) {
  return [
    hasItems(quote.materialRows) ? null : 'Material faltante',
    hasItems(quote.measureRows) ? null : 'Medidas pendientes',
    Number(quote.deposit || 0) > 0 ? null : 'Anticipo incompleto',
    form.clienteTelefono || form.whatsapp ? null : 'Cliente sin teléfono',
    form.entrega ? null : 'Fecha compromiso pendiente',
    workflow.inventarioCompleto ? null : 'Inventario pendiente',
  ].filter(Boolean);
}

export function getNextRecommendation({ form = {}, quote = {}, workflow = {} } = {}) {
  const stage = getProjectStage({ quote, workflow });
  if (stage === 'Cotización') return 'Confirmar anticipo para liberar producción';
  if (stage === 'Producción' && hasItems(workflow.compraItems) && !isCompleteList(workflow.recepcionItems)) return 'Recibir y verificar materiales';
  if (stage === 'Producción') return quote.materialRows?.[0]?.nombre ? `Comprar ${quote.materialRows[0].nombre}` : 'Definir materiales de compra';
  if (stage === 'Recepción') return 'Registrar recepción de materiales';
  if (stage === 'Inventario') return 'Convertir materiales recibidos en existencias';
  if (stage === 'Fabricación' && Number(workflow.fabricacionChecklist || 0) < 100) return 'Continuar fabricación y completar checklist';
  if (stage === 'Fabricación') return 'Programar corte y armado';
  if (stage === 'Control de calidad') return 'Revisar acabado y medidas finales';
  if (stage === 'Instalación') return 'Agendar instalación con cliente';
  if (stage === 'Entrega') return 'Recabar firma de entrega';
  if (stage === 'Garantía') return workflow.proyectoCerrado || workflow.entregaFirmada ? 'Proyecto cerrado; garantía activa' : 'Mantener garantía activa';
  return form.producto ? `Revisar proyecto ${form.producto}` : 'Revisar datos del proyecto';
}
