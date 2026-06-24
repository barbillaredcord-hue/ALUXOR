// cSpell:words anunciapro
const { get, put } = require('@vercel/blob');

const HISTORY_PATH = 'anunciapro/history.json';
const MAX_ITEMS = 200;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function streamToText(stream) {
  const reader = stream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks).toString('utf8');
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object' || !record.id) return null;

  return {
    ...record,
    createdAt: record.createdAt || Number(String(record.id).replace(/\D/g, '')) || Date.now(),
    date: record.date || new Date().toLocaleDateString('es-MX'),
    status: record.status || 'Pendiente',
  };
}

function mergeHistory(...lists) {
  const map = new Map();

  lists.flat().forEach((record) => {
    const normalized = normalizeRecord(record);
    if (!normalized) return;
    map.set(normalized.id, { ...(map.get(normalized.id) || {}), ...normalized });
  });

  return Array.from(map.values())
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, MAX_ITEMS);
}

async function readHistory() {
  const file = await get(HISTORY_PATH, { access: 'private', useCache: false });
  if (!file?.stream) return [];

  const text = await streamToText(file.stream);
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? mergeHistory(parsed) : [];
}

async function writeHistory(history) {
  const normalized = mergeHistory(history);
  await put(HISTORY_PATH, JSON.stringify(normalized), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 0,
  });
  return normalized;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return send(res, 200, { history: await readHistory() });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const current = await readHistory();
      const history = await writeHistory(mergeHistory(body.record, current));
      return send(res, 200, { history });
    }

    if (req.method === 'PUT') {
      const body = await readBody(req);
      const current = await readHistory();
      const history = await writeHistory(mergeHistory(body.history || [], current));
      return send(res, 200, { history });
    }

    if (req.method === 'DELETE') {
      const id = new URL(req.url, 'https://anunciapro.vercel.app').searchParams.get('id');
      const current = await readHistory();
      const history = await writeHistory(current.filter((item) => item.id !== id));
      return send(res, 200, { history });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return send(res, 405, { error: 'Método no permitido' });
  } catch (error) {
    return send(res, 500, {
      error: 'No se pudo sincronizar el historial',
      detail: error.message,
    });
  }
};
