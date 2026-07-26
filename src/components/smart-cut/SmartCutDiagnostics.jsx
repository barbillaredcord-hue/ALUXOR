import { AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';

function messageFor(item) {
  if (typeof item === 'string') return item;
  return item?.message || item?.reason || item?.code || null;
}

function uniqueMessages(items) {
  return [...new Set(items.map(messageFor).filter(Boolean))];
}

export default function SmartCutDiagnostics({ candidate, rankingEntry }) {
  const warnings = uniqueMessages(candidate?.validation?.warnings || []);
  const diagnostics = uniqueMessages([
    ...(candidate?.diagnostics || []),
    ...(candidate?.validation?.errors || []),
  ]);
  const reasons = uniqueMessages(
    rankingEntry?.reasons || candidate?.evaluation?.reasons || [],
  );

  return (
    <section className="smart-cut-diagnostics" aria-labelledby="smart-cut-diagnostics-title">
      <h4 id="smart-cut-diagnostics-title"><ClipboardList size={18} aria-hidden="true" /> Diagnóstico y razones</h4>
      <div className="smart-cut-diagnostics__columns">
        <article>
          <h5>Advertencias</h5>
          {warnings.length ? (
            <ul>{warnings.map((warning) => <li key={warning}><AlertTriangle size={15} aria-hidden="true" /> {warning}</li>)}</ul>
          ) : <p><CheckCircle2 size={15} aria-hidden="true" /> Sin advertencias registradas.</p>}
        </article>
        <article>
          <h5>Diagnósticos</h5>
          {diagnostics.length ? (
            <ul>{diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}</ul>
          ) : <p><CheckCircle2 size={15} aria-hidden="true" /> Sin diagnósticos críticos.</p>}
        </article>
        <article>
          <h5>Evaluación</h5>
          {reasons.length ? (
            <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          ) : <p>No hay razones de evaluación registradas.</p>}
        </article>
      </div>
    </section>
  );
}
