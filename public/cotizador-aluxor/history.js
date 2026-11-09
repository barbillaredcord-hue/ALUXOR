/* Local quote snapshots. Never persist session credentials or depend on live catalog prices. */
(() => {
  const scope = new URLSearchParams(location.hash.slice(1));
  const key = scope.get('user') ? `aluxor:quotes:v1:${scope.get('user')}:${scope.get('workspace') || 'personal'}` : null;
  const fields = ['folio', 'date', 'client', 'phone', 'project', 'address', 'iva', 'depositPct', 'discountType', 'discountValue', 'notes'];
  const status = document.getElementById('quoteSaveStatus');
  let activeId = null;
  let timer;
  const id = () => crypto.randomUUID();
  function read() {
    if (!key) throw Error('Abre el cotizador desde tu cuenta de BRTuNegocio para guardar y consultar el historial.');
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data) || data.some(q => !q || typeof q.id !== 'string' || !q.fields || !Array.isArray(q.items))) {
      throw Error('No fue posible leer el historial. No se modificaron los datos guardados.');
    }
    return data;
  }
  function snapshot() {
    const values = Object.fromEntries(fields.map(k => [k, document.getElementById(k).value]));
    const frozenItems = items.map(it => {
      const p = catalog.find(p => p.id === it.productId);
      return { ...it, customName: it.customName || p?.name || '', customDescription: it.customDescription || p?.description || '', unit: it.unit || p?.unit || '', price: Number(it.price ?? p?.price ?? 0), productId: '' };
    });
    return { fields: values, items: frozenItems, logo: selectedLogoKey, total: totals().total };
  }
  function meaningful(q) {
    return ['client', 'phone', 'project', 'address'].some(k => q.fields[k].trim()) || q.items.some(it => it.customName.trim() || it.price);
  }
  function save(manual = false) {
    clearTimeout(timer);
    try {
      const q = snapshot();
      if (!meaningful(q)) {
        if (manual) status.textContent = 'Agrega un cliente, proyecto o producto antes de guardar.';
        return false;
      }
      const records = read();
      const existing = records.find(r => r.id === activeId);
      const now = new Date().toISOString();
      const saved = { ...q, id: activeId || id(), createdAt: existing?.createdAt || now, updatedAt: now };
      localStorage.setItem(key, JSON.stringify([saved, ...records.filter(r => r.id !== saved.id)]));
      activeId = saved.id;
      status.textContent = 'Cotización guardada en este dispositivo · ' + new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      return true;
    } catch (error) {
      status.textContent = key ? 'No se pudo guardar. Revisa el almacenamiento del navegador; conserva esta pestaña abierta. ' + error.message : error.message;
      return false;
    }
  }
  function renderHistory() {
    const list = document.getElementById('historyList');
    const count = document.getElementById('historyCount');
    try {
      const search = document.getElementById('historySearch').value.trim().toLocaleLowerCase('es-MX');
      const records = read().filter(q => ['folio', 'client', 'project'].some(k => String(q.fields[k] || '').toLocaleLowerCase('es-MX').includes(search))).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
      count.textContent = `${records.length} cotizaciones`;
      list.innerHTML = records.map(q => `<article class="item"><h3>${esc(q.fields.folio)} · ${esc(q.fields.client || 'Sin cliente')}</h3><p>${esc(q.fields.project || 'Sin proyecto')} · ${esc(q.fields.date)} · <strong>${money(q.total)}</strong></p><p class="small">Actualizada: ${esc(new Date(q.updatedAt).toLocaleString('es-MX'))}</p><div class="actions"><button class="btn primary" data-history="open" data-id="${esc(q.id)}">Abrir / editar</button><button class="btn" data-history="duplicate" data-id="${esc(q.id)}">Duplicar</button><button class="btn ok" data-history="pdf" data-id="${esc(q.id)}">Vista PDF</button></div></article>`).join('') || '<div class="empty">No hay cotizaciones que mostrar.</div>';
    } catch (error) {
      count.textContent = '';
      list.textContent = error.message;
    }
  }
  function load(record, duplicate) {
    fields.forEach(k => { document.getElementById(k).value = record.fields[k] ?? ''; });
    items = structuredClone(record.items);
    selectedLogoKey = record.logo === 'bosquereal' ? 'bosquereal' : 'aluxor';
    pdfLogoData = PDF_LOGOS[selectedLogoKey];
    document.querySelectorAll('.pdf-logo-choice').forEach(b => b.classList.toggle('active', b.dataset.logo === selectedLogoKey));
    activeId = duplicate ? null : record.id;
    if (duplicate) {
      document.getElementById('folio').value = newFolio();
      document.getElementById('date').value = new Date().toISOString().slice(0,10);
    }
    renderItems(); recalc(); show('quote');
    status.textContent = duplicate ? 'Copia creada. Guarda para conservarla en el historial.' : 'Cotización recuperada del historial.';
    if (duplicate) save(true);
  }
  document.getElementById('saveQuoteBtn').onclick = () => save(true);
  document.getElementById('historySearch').oninput = renderHistory;
  document.getElementById('historyList').onclick = e => {
    const button = e.target.closest('[data-history]');
    if (!button) return;
    // Preserve current edits before switching to another record.
    if (meaningful(snapshot()) && !save()) return;
    try {
      const record = read().find(q => q.id === button.dataset.id);
      if (!record) { renderHistory(); return; }
      load(record, button.dataset.history === 'duplicate');
      if (button.dataset.history === 'pdf') preview();
    } catch (error) { status.textContent = error.message; }
  };
  const originalPreview = preview;
  preview = () => { save(); originalPreview(); };
  // Existing handlers that hold the original function are covered by the click listener below.
  const originalReset = document.getElementById('resetBtn').onclick;
  document.getElementById('resetBtn').onclick = () => {
    if (meaningful(snapshot()) && !save()) return;
    activeId = null;
    originalReset();
    status.textContent = '';
  };
  document.getElementById('quoteView').addEventListener('input', () => {
    clearTimeout(timer); timer = setTimeout(() => save(), 600);
  });
  document.addEventListener('click', e => {
    if (e.target.closest('#historyView') || e.target.closest('#resetBtn')) return;
    if (e.target.closest('[data-view="history"]')) { save(); renderHistory(); }
    else if (e.target.closest('.btn,.pdf-logo-choice,[data-view="preview"]')) save();
  });
  window.addEventListener('pagehide', () => save());
  window.addEventListener('storage', e => { if (e.key === key) renderHistory(); });
  if (!key) status.textContent = 'Abre el cotizador desde tu cuenta de BRTuNegocio para usar el historial.';
})();
