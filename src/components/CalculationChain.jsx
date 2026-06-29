import { Check } from 'lucide-react';

export default function CalculationChain({ title, steps, defaultOpen = false }) {
  const toneForStep = (step) => {
    const label = `${step.title} ${step.next || ''}`.toLowerCase();
    if (/medida|área|lineal|cantidad|pieza/.test(label)) return 'measure';
    if (/material|hoja|madera|merma/.test(label)) return 'material';
    if (/precio|utilidad|saldo|anticipo|resultado|documento|cliente/.test(label)) return 'result';
    if (/advert|riesgo|faltante|negativa/.test(label)) return 'warning';
    return 'calc';
  };
  return (
    <details className="calc-chain" open={defaultOpen}>
      <summary><span>Operación</span><strong>{title}</strong></summary>
      <div className="calc-chain-flow">
        {steps.filter(Boolean).map((step, index) => {
          const tone = step.tone || toneForStep(step);
          return (
          <article key={`${step.title}-${index}-${step.result}`} className={`calc-step calc-step-${tone}`}>
            <div className="calc-step-main">
              <div className="calc-step-icon"><Check size={14} /></div>
              <h4>{step.title}</h4>
              <strong className="calc-step-value">{step.result}</strong>
            </div>
            <details className="calc-step-info">
              <summary aria-label={`Ver explicación de ${step.title}`}>?</summary>
              {step.input && <p><strong>Entrada:</strong> {step.input}</p>}
              {step.operation && <p><strong>Operación:</strong> {step.operation}</p>}
              {step.next && <p className="calc-next"><strong>Sigue:</strong> {step.next}</p>}
            </details>
          </article>
        );
        })}
      </div>
    </details>
  );
}
