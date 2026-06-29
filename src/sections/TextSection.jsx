import { Copy } from 'lucide-react';

export default function TextSection({ outputs, quoteOutput, copyText }) {
  return (
    <section className="panel-grid two-cols">
      {outputs.map((output) => (
        <article key={output.name} className="panel output-card">
          <h2>{output.name}</h2>
          <p>{output.description}</p>
          <textarea readOnly value={output.text} />
          <button type="button" onClick={() => copyText(output.text, output.name)}><Copy size={18} /> Copiar</button>
        </article>
      ))}
      <article className="panel output-card">
        <h2>Cotización para cliente</h2>
        <textarea readOnly value={quoteOutput.text} />
        <button type="button" onClick={() => copyText(quoteOutput.text, 'Cotización')}>Copiar cotización</button>
      </article>
    </section>
  );
}
