import { Copy } from 'lucide-react';
import Field from '../components/Field.jsx';

export default function AnnouncementSection({
  form,
  update,
  guideFor,
  input,
  textareaInput,
  currentTypeOptions,
  tonos,
  mainOutput,
  copyText,
  readOnly = false,
}) {
  return (
    <section className="panel-grid two-cols">
      <article className="panel">
        <h2>Datos del anuncio</h2>
        <div className="form-grid">
          <Field id="giro" label="Giro">
            <select id="giro" disabled={readOnly} value={form.giro} onChange={(event) => update('giro', event.target.value)}>
              <option>Carpintería</option>
              <option>Vidriería</option>
            </select>
          </Field>
          <Field id="tipoTrabajo" label="Tipo de trabajo" {...guideFor('tipoTrabajo')}>
            <select id="tipoTrabajo" disabled={readOnly} value={form.tipoTrabajo} onChange={(event) => update('tipoTrabajo', event.target.value)}>
              {currentTypeOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field id="producto" label="Producto" {...guideFor('producto')}>{input('producto')}</Field>
          <Field id="material" label="Material" {...guideFor('material')}>{input('material')}</Field>
          <Field id="acabado" label="Acabado">{input('acabado')}</Field>
          <Field id="ciudad" label="Ciudad">{input('ciudad')}</Field>
          <Field id="whatsapp" label="WhatsApp" {...guideFor('whatsapp')}>{input('whatsapp')}</Field>
          <Field id="beneficio" label="Beneficio">{textareaInput('beneficio')}</Field>
          <Field id="incluye" label="Incluye">{textareaInput('incluye')}</Field>
          <Field id="promocion" label="Promoción">{input('promocion')}</Field>
          <Field id="tono" label="Tono">
            <select id="tono" disabled={readOnly} value={form.tono} onChange={(event) => update('tono', event.target.value)}>
              {Object.entries(tonos).map(([key, tone]) => <option key={key} value={key}>{tone.title}</option>)}
            </select>
          </Field>
        </div>
      </article>

      <article className="panel output-card">
        <h2>{mainOutput.name}</h2>
        <p>{mainOutput.description}</p>
        <textarea readOnly value={mainOutput.text} />
        <button type="button" onClick={() => copyText(mainOutput.text, mainOutput.name)}>
          <Copy size={18} /> Copiar anuncio
        </button>
      </article>
    </section>
  );
}
