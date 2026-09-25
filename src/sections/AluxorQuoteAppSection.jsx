import { ExternalLink } from 'lucide-react';

const ALUXOR_QUOTE_APP_URL = 'https://cotizador-aluxor-fabian-br-ed-s-projects.vercel.app/';

export default function AluxorQuoteAppSection() {
  return (
    <section className="panel aluxor-quote-app-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Ventas · Cotizaciones</p>
          <h2>Cotizador ALUXOR</h2>
          <p>
            Crea cotizaciones rápidas, interpreta imágenes, edita productos y genera el PDF
            desde BRTuNegocio.
          </p>
        </div>
        <a
          className="ghost button-link"
          href={ALUXOR_QUOTE_APP_URL}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} />
          Abrir aparte
        </a>
      </div>

      <div className="aluxor-quote-app-frame-shell">
        <iframe
          className="aluxor-quote-app-frame"
          src={ALUXOR_QUOTE_APP_URL}
          title="Cotizador ALUXOR"
          loading="lazy"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </section>
  );
}
