const ALUXOR_QUOTE_APP_URL = './cotizador-aluxor/';

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
