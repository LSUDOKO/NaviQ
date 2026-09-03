import LoadingSpinner from "../components/common/LoadingSpinner";
import Panel from "../components/common/Panel";
import { useAsync } from "../hooks/usePrediction";
import api from "../services/api";

interface About {
  project: string;
  subtitle: string;
  event: string;
  problem_statement_id: string;
  theme: string;
  organisation: string;
  innovation: string;
  differentiators: string[];
  references: string[];
}

export function AboutPage() {
  const about = useAsync<About>(() => api.about(), []);
  const model = useAsync<{ mode: string; metrics: Record<string, number> }>(
    () => api.modelInfo(),
    [],
  );

  if (about.loading) return <LoadingSpinner label="Loading" />;
  if (!about.data) return null;

  const data = about.data;

  return (
    <div className="max-w-4xl space-y-5">
      <Panel>
        <p className="font-mono text-3xl font-bold tracking-[0.2em] text-slate-50 mb-2">NAVIQ</p>
        <p className="text-base text-slate-300 mb-5">{data.subtitle}</p>
        <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">{data.innovation}</p>

        <dl className="grid gap-4 sm:grid-cols-4 mt-6 pt-5 border-t border-navy-700/70">
          {[
            ["Event", data.event],
            ["Problem statement", data.problem_statement_id],
            ["Theme", data.theme],
            ["Organisation", data.organisation],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-2xs text-slate-500 mb-1">{label}</dt>
              <dd className="text-sm text-slate-200">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="What makes this different" subtitle="Seven things no existing platform combines">
        <ol className="space-y-3">
          {data.differentiators.map((item, index) => (
            <li key={item} className="flex gap-3.5 text-sm">
              <span className="metric text-xs text-teal shrink-0 pt-0.5 w-4">{index + 1}</span>
              <span className="text-slate-300 leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      </Panel>

      {model.data?.metrics && Object.keys(model.data.metrics).length > 0 && (
        <Panel title="Prediction model" subtitle="Trained and validated, not a placeholder">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            {[
              { label: "Mode", value: model.data.mode === "neural" ? "Neural" : "Physics" },
              {
                label: "Parameters",
                value: model.data.metrics.parameters
                  ? `${Math.round(model.data.metrics.parameters / 1000)}k`
                  : "—",
              },
              {
                label: "Validation error",
                value: model.data.metrics.final_val_mape_pct
                  ? `${model.data.metrics.final_val_mape_pct.toFixed(2)}%`
                  : "—",
              },
              {
                label: "Mean absolute error",
                value: model.data.metrics.final_val_mae_kg_per_h
                  ? `${Math.round(model.data.metrics.final_val_mae_kg_per_h)} kg/h`
                  : "—",
              },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xs text-slate-500 mb-1">{stat.label}</p>
                <p className="metric text-lg text-slate-100">{stat.value}</p>
              </div>
            ))}
          </div>
          <p className="text-2xs text-slate-500 leading-relaxed mt-4 pt-4 border-t border-navy-700/70">
            A bidirectional LSTM with time-aware self-attention, trained under a physics-informed
            loss that penalises violations of energy conservation and cubic speed scaling.
            Uncertainty is decomposed into model ignorance, from Monte Carlo Dropout, and
            irreducible sensor noise, from a learned variance head.
          </p>
        </Panel>
      )}

      <Panel title="References" subtitle="The literature this implementation follows">
        <ul className="space-y-2">
          {data.references.map((reference) => (
            <li key={reference} className="text-xs text-slate-400 leading-relaxed">
              {reference}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export default AboutPage;
