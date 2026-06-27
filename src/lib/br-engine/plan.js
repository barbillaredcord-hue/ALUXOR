function getHelpers(helpers = {}) {
  return helpers;
}

export function normalizePlanItem(item, index = 0, helpers = {}) {
  const { clean, numberValue } = getHelpers(helpers);
  return {
    id: item?.id || `plano-${Date.now()}-${index}`,
    nombre: clean(item?.nombre, `Pieza ${index + 1}`),
    forma: clean(item?.forma, 'Pieza vertical'),
    ancho: numberValue(item?.ancho),
    alto: numberValue(item?.alto),
    fondo: numberValue(item?.fondo),
    cantidad: Math.max(1, numberValue(item?.cantidad) || 1),
    nota: clean(item?.nota),
    posX: item?.posX === '' || item?.posX === undefined || item?.posX === null ? '' : numberValue(item.posX),
    posY: item?.posY === '' || item?.posY === undefined || item?.posY === null ? '' : numberValue(item.posY),
    posZ: item?.posZ === '' || item?.posZ === undefined || item?.posZ === null ? '' : numberValue(item.posZ),
  };
}

export function planItemsFromForm(data, helpers = {}) {
  const items = Array.isArray(data.planItems) ? data.planItems : [];
  const normalized = items.map((item, index) => normalizePlanItem(item, index, helpers)).filter((item) => item.ancho > 0 && item.alto > 0);
  if (normalized.length > 0) return normalized;

  return [normalizePlanItem({
    id: 'pieza-principal',
    nombre: data.tipoTrabajo || 'Vista principal',
    forma: 'Pieza vertical',
    ancho: data.ancho,
    alto: data.alto,
    fondo: data.fondo,
    cantidad: data.cantidad,
    nota: 'Medida general del proyecto',
  }, 0, helpers)];
}

export function planPart(id, nombre, forma, ancho, alto, fondo, posX, posY, posZ, nota = '') {
  return {
    id,
    nombre,
    forma,
    ancho: Math.max(1, Math.round(ancho)),
    alto: Math.max(1, Math.round(alto)),
    fondo: Math.max(1, Math.round(fondo)),
    cantidad: 1,
    nota,
    posX: Math.round(posX),
    posY: Math.round(posY),
    posZ: Math.round(posZ),
  };
}

export function planTemplateData(templateId, data, helpers = {}) {
  const { numberValue } = getHelpers(helpers);
  const ancho = Math.max(60, numberValue(data.ancho) || 120);
  const alto = Math.max(45, numberValue(data.alto) || 90);
  const fondo = Math.max(8, numberValue(data.fondo) || 45);
  const thick = Math.max(3, Math.round(Math.min(ancho, alto, fondo) * 0.04));
  const halfW = ancho / 2;
  const halfD = fondo / 2;
  const items = [];

  if (templateId === 'escritorio') {
    const topY = alto - thick / 2;
    items.push(
      planPart('desk-top', 'Cubierta', 'Cubierta / repisa', ancho, thick, fondo, 0, topY, 0, 'Mesa superior'),
      planPart('desk-left-leg-front', 'Pata izq. frente', 'Pata', thick * 1.5, alto - thick, thick * 1.5, -halfW + thick, (alto - thick) / 2, -halfD + thick, 'Soporte'),
      planPart('desk-right-leg-front', 'Pata der. frente', 'Pata', thick * 1.5, alto - thick, thick * 1.5, halfW - thick, (alto - thick) / 2, -halfD + thick, 'Soporte'),
      planPart('desk-left-leg-back', 'Pata izq. fondo', 'Pata', thick * 1.5, alto - thick, thick * 1.5, -halfW + thick, (alto - thick) / 2, halfD - thick, 'Soporte'),
      planPart('desk-right-leg-back', 'Pata der. fondo', 'Pata', thick * 1.5, alto - thick, thick * 1.5, halfW - thick, (alto - thick) / 2, halfD - thick, 'Soporte'),
      planPart('desk-modulo', 'Cajonera lateral', 'Cajón', Math.max(30, ancho * 0.28), alto * 0.72, fondo * 0.9, halfW - Math.max(18, ancho * 0.14), alto * 0.36, 0, 'Módulo editable'),
    );
  } else if (templateId === 'mueble') {
    items.push(
      planPart('cab-left', 'Lateral izquierdo', 'Lateral', thick, alto, fondo, -halfW + thick / 2, alto / 2, 0, 'Costado'),
      planPart('cab-right', 'Lateral derecho', 'Lateral', thick, alto, fondo, halfW - thick / 2, alto / 2, 0, 'Costado'),
      planPart('cab-top', 'Tapa superior', 'Cubierta / repisa', ancho, thick, fondo, 0, alto - thick / 2, 0, 'Tapa'),
      planPart('cab-bottom', 'Base', 'Cubierta / repisa', ancho, thick, fondo, 0, thick / 2, 0, 'Base'),
      planPart('cab-shelf', 'Repisa central', 'Cubierta / repisa', ancho - thick * 2, thick, fondo * 0.92, 0, alto * 0.52, 0, 'Repisa'),
      planPart('cab-door-left', 'Puerta izquierda', 'Puerta', ancho / 2 - thick, alto - thick * 2, thick, -ancho / 4, alto / 2, -halfD - thick, 'Frente'),
      planPart('cab-door-right', 'Puerta derecha', 'Puerta', ancho / 2 - thick, alto - thick * 2, thick, ancho / 4, alto / 2, -halfD - thick, 'Frente'),
    );
  } else if (templateId === 'buro') {
    items.push(
      planPart('night-top', 'Cubierta', 'Cubierta / repisa', ancho, thick, fondo, 0, alto - thick / 2, 0, 'Tapa'),
      planPart('night-left', 'Lateral izquierdo', 'Lateral', thick, alto, fondo, -halfW + thick / 2, alto / 2, 0, 'Costado'),
      planPart('night-right', 'Lateral derecho', 'Lateral', thick, alto, fondo, halfW - thick / 2, alto / 2, 0, 'Costado'),
      planPart('night-base', 'Base', 'Cubierta / repisa', ancho, thick, fondo, 0, thick / 2, 0, 'Base'),
      planPart('night-drawer-1', 'Cajón superior', 'Cajón', ancho - thick * 3, alto * 0.22, thick, 0, alto * 0.68, -halfD - thick, 'Frente de cajón'),
      planPart('night-drawer-2', 'Cajón inferior', 'Cajón', ancho - thick * 3, alto * 0.32, thick, 0, alto * 0.34, -halfD - thick, 'Frente de cajón'),
    );
  } else if (templateId === 'ventana') {
    const frame = Math.max(4, thick);
    items.push(
      planPart('win-left', 'Marco izquierdo', 'Marco / riel', frame, alto, frame, -halfW + frame / 2, alto / 2, 0, 'Perfil'),
      planPart('win-right', 'Marco derecho', 'Marco / riel', frame, alto, frame, halfW - frame / 2, alto / 2, 0, 'Perfil'),
      planPart('win-top', 'Marco superior', 'Marco / riel', ancho, frame, frame, 0, alto - frame / 2, 0, 'Perfil'),
      planPart('win-bottom', 'Marco inferior', 'Marco / riel', ancho, frame, frame, 0, frame / 2, 0, 'Perfil'),
      planPart('win-glass-left', 'Vidrio izquierdo', 'Vidrio', ancho / 2 - frame * 1.5, alto - frame * 2, 2, -ancho / 4, alto / 2, 0, 'Hoja de vidrio'),
      planPart('win-glass-right', 'Vidrio derecho', 'Vidrio', ancho / 2 - frame * 1.5, alto - frame * 2, 2, ancho / 4, alto / 2, 2, 'Hoja corrediza'),
    );
  } else if (templateId === 'cancel') {
    const rail = Math.max(4, thick);
    items.push(
      planPart('cancel-top-rail', 'Riel superior', 'Marco / riel', ancho, rail, rail, 0, alto - rail / 2, 0, 'Riel'),
      planPart('cancel-bottom-rail', 'Riel inferior', 'Marco / riel', ancho, rail, rail, 0, rail / 2, 0, 'Riel'),
      planPart('cancel-glass-fixed', 'Cristal fijo', 'Vidrio', ancho / 2, alto - rail * 2, 2, -ancho / 4, alto / 2, 0, 'Fijo'),
      planPart('cancel-glass-door', 'Cristal corredizo', 'Vidrio', ancho / 2, alto - rail * 2, 2, ancho / 4, alto / 2, 6, 'Corredizo'),
      planPart('cancel-handle', 'Jaladera', 'Marco / riel', 3, Math.max(28, alto * 0.18), 4, ancho * 0.18, alto * 0.52, -4, 'Herraje'),
    );
  } else {
    items.push(
      planPart('closet-left', 'Lateral izquierdo', 'Lateral', thick, alto, fondo, -halfW + thick / 2, alto / 2, 0, 'Costado'),
      planPart('closet-right', 'Lateral derecho', 'Lateral', thick, alto, fondo, halfW - thick / 2, alto / 2, 0, 'Costado'),
      planPart('closet-top', 'Tapa superior', 'Cubierta / repisa', ancho, thick, fondo, 0, alto - thick / 2, 0, 'Tapa'),
      planPart('closet-bottom', 'Base', 'Cubierta / repisa', ancho, thick, fondo, 0, thick / 2, 0, 'Base'),
      planPart('closet-divider', 'División central', 'Lateral', thick, alto - thick * 2, fondo, 0, alto / 2, 0, 'División'),
      planPart('closet-shelf-left', 'Repisa izquierda', 'Cubierta / repisa', ancho / 2 - thick, thick, fondo * 0.92, -ancho / 4, alto * 0.62, 0, 'Repisa'),
      planPart('closet-shelf-right', 'Repisa derecha', 'Cubierta / repisa', ancho / 2 - thick, thick, fondo * 0.92, ancho / 4, alto * 0.42, 0, 'Repisa'),
      planPart('closet-door-left', 'Puerta izquierda', 'Puerta', ancho / 2 - thick, alto - thick * 2, thick, -ancho / 4, alto / 2, -halfD - thick, 'Frente'),
      planPart('closet-door-right', 'Puerta derecha', 'Puerta', ancho / 2 - thick, alto - thick * 2, thick, ancho / 4, alto / 2, -halfD - thick, 'Frente'),
    );
  }

  return items.map((item, index) => normalizePlanItem(item, index, helpers));
}

export function planSvg(data, helpers = {}) {
  const { escapeHtml, formatDimensions } = getHelpers(helpers);
  const items = planItemsFromForm(data, helpers);
  const width = 900;
  const height = 520;
  const margin = 70;
  const gap = 18;
  const totalWidth = items.reduce((sum, item) => sum + item.ancho, 0) + gap * Math.max(0, items.length - 1);
  const maxHeight = Math.max(...items.map((item) => item.alto), 1);
  const scale = Math.min((width - margin * 2) / Math.max(totalWidth, 1), (height - margin * 2 - 48) / maxHeight);
  const baseY = height - margin - 52;
  let cursorX = margin;

  const pieces = items.map((item) => {
    const rectWidth = Math.max(42, item.ancho * scale);
    const rectHeight = Math.max(42, item.alto * scale);
    const x = cursorX;
    const y = baseY - rectHeight;
    cursorX += rectWidth + gap;

    return `
      <g>
        <rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" rx="8" fill="#fffdf8" stroke="#33443b" stroke-width="3" />
        <rect x="${x + 10}" y="${y + 10}" width="${Math.max(20, rectWidth - 20)}" height="${Math.max(20, rectHeight - 20)}" rx="5" fill="none" stroke="#bdd8ce" stroke-width="2" />
        <text x="${x + rectWidth / 2}" y="${y + 28}" text-anchor="middle" font-size="15" font-weight="800" fill="#17201b">${escapeHtml(item.nombre)}</text>
        <text x="${x + rectWidth / 2}" y="${y + rectHeight / 2 + 5}" text-anchor="middle" font-size="16" font-weight="900" fill="#22745f">${item.ancho} x ${item.alto} cm</text>
        <text x="${x + rectWidth / 2}" y="${y + rectHeight - 18}" text-anchor="middle" font-size="13" font-weight="700" fill="#526159">Fondo ${item.fondo || 0} cm · Cant. ${item.cantidad}</text>
        <line x1="${x}" y1="${baseY + 14}" x2="${x + rectWidth}" y2="${baseY + 14}" stroke="#22745f" stroke-width="2" />
        <text x="${x + rectWidth / 2}" y="${baseY + 36}" text-anchor="middle" font-size="13" font-weight="800" fill="#173d34">${item.ancho} cm</text>
      </g>
    `;
  }).join('');

  const notes = items
    .filter((item) => item.nota)
    .map((item) => `${escapeHtml(item.nombre)}: ${escapeHtml(item.nota)}`)
    .join(' · ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Plano de cotización">
    <rect width="${width}" height="${height}" fill="#edf5f1" />
    <path d="M0 0H${width}V${height}H0Z" fill="url(#grid)" />
    <defs>
      <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M24 0H0V24" fill="none" stroke="#d8e7df" stroke-width="1" />
      </pattern>
    </defs>
    <text x="${margin}" y="38" font-size="20" font-weight="900" fill="#17201b">${escapeHtml(data.producto || 'Plano del proyecto')}</text>
    <text x="${margin}" y="62" font-size="14" font-weight="700" fill="#526159">${escapeHtml(formatDimensions(data))}</text>
    ${pieces}
    ${notes ? `<text x="${margin}" y="${height - 20}" font-size="13" font-weight="700" fill="#526159">${notes.slice(0, 170)}</text>` : ''}
  </svg>`;
}

export function planSvg3d(data, helpers = {}) {
  const { escapeHtml, formatDimensions } = getHelpers(helpers);
  const items = planItemsFromForm(data, helpers);
  const width = 900;
  const height = 560;
  const margin = 70;
  const gap = 34;
  const totalWidth = items.reduce((sum, item) => sum + Math.max(item.ancho, 1), 0) + gap * Math.max(0, items.length - 1);
  const maxHeight = Math.max(...items.map((item) => item.alto), 1);
  const maxDepth = Math.max(...items.map((item) => item.fondo || 20), 20);
  const scale = Math.min(
    (width - margin * 2) / Math.max(totalWidth + maxDepth * 0.9, 1),
    (height - margin * 2 - 70) / Math.max(maxHeight + maxDepth * 0.45, 1),
  );
  const baseY = height - margin - 58;
  let cursorX = margin + 16;

  const pieces = items.map((item, index) => {
    const pieceWidth = Math.max(58, item.ancho * scale);
    const pieceHeight = Math.max(58, item.alto * scale);
    const depth = Math.max(18, (item.fondo || 20) * scale * 0.72);
    const depthX = depth * 0.72;
    const depthY = depth * 0.42;
    const x = cursorX;
    const y = baseY - pieceHeight;
    cursorX += pieceWidth + gap;
    const hue = data.giro === 'Vidriería' ? ['#d9f1f4', '#a9dbe0', '#effbfc'] : ['#f4dfbe', '#c99b5f', '#fff3da'];
    const edge = data.giro === 'Vidriería' ? '#2b7580' : '#5f4630';

    return `
      <g>
        <polygon points="${x},${y} ${x + depthX},${y - depthY} ${x + pieceWidth + depthX},${y - depthY} ${x + pieceWidth},${y}" fill="${hue[2]}" stroke="${edge}" stroke-width="2" />
        <polygon points="${x + pieceWidth},${y} ${x + pieceWidth + depthX},${y - depthY} ${x + pieceWidth + depthX},${y + pieceHeight - depthY} ${x + pieceWidth},${y + pieceHeight}" fill="${hue[1]}" stroke="${edge}" stroke-width="2" />
        <rect x="${x}" y="${y}" width="${pieceWidth}" height="${pieceHeight}" rx="8" fill="${hue[0]}" stroke="${edge}" stroke-width="3" />
        <rect x="${x + 12}" y="${y + 12}" width="${Math.max(24, pieceWidth - 24)}" height="${Math.max(24, pieceHeight - 24)}" rx="5" fill="none" stroke="rgba(23,32,27,.25)" stroke-width="2" />
        <line x1="${x}" y1="${y + pieceHeight}" x2="${x + depthX}" y2="${y + pieceHeight - depthY}" stroke="${edge}" stroke-width="2" />
        <line x1="${x + depthX}" y1="${y + pieceHeight - depthY}" x2="${x + pieceWidth + depthX}" y2="${y + pieceHeight - depthY}" stroke="${edge}" stroke-width="2" opacity=".55" />
        <text x="${x + pieceWidth / 2}" y="${y + 30}" text-anchor="middle" font-size="15" font-weight="900" fill="#17201b">${escapeHtml(item.nombre)}</text>
        <text x="${x + pieceWidth / 2}" y="${y + pieceHeight / 2 + 5}" text-anchor="middle" font-size="17" font-weight="950" fill="#173d34">${item.ancho} x ${item.alto}</text>
        <text x="${x + pieceWidth / 2}" y="${y + pieceHeight - 18}" text-anchor="middle" font-size="13" font-weight="800" fill="#526159">Fondo ${item.fondo || 0} cm · Cant. ${item.cantidad}</text>
        <circle cx="${x + 18}" cy="${y + pieceHeight + 25}" r="6" fill="${index % 2 ? '#22745f' : '#e3b64b'}" />
        <text x="${x + 32}" y="${y + pieceHeight + 30}" font-size="12" font-weight="850" fill="#526159">${escapeHtml(item.nota || 'Pieza editable')}</text>
      </g>
    `;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Plano editable en 3D">
    <rect width="${width}" height="${height}" fill="#edf5f1" />
    <path d="M0 0H${width}V${height}H0Z" fill="url(#grid3d)" />
    <defs>
      <pattern id="grid3d" width="28" height="28" patternUnits="userSpaceOnUse">
        <path d="M28 0H0V28" fill="none" stroke="#d8e7df" stroke-width="1" />
      </pattern>
    </defs>
    <text x="${margin}" y="38" font-size="20" font-weight="900" fill="#17201b">${escapeHtml(data.producto || 'Plano 3D del proyecto')}</text>
    <text x="${margin}" y="64" font-size="14" font-weight="800" fill="#526159">${escapeHtml(formatDimensions(data))} · Vista con profundidad</text>
    ${pieces}
  </svg>`;
}
