import "katex/dist/katex.min.css";
import katex from "katex";
import { useMemo, useState } from "react";
import type { Formula } from "../../types";

function Rendered({ latex }: { latex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: false });
    } catch {
      return `<code>${latex}</code>`;
    }
  }, [latex]);
  return <div className="overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * A collapsible panel showing the mathematics behind a page.
 *
 * Collapsed by default: an operator wants the answer, and a judge wants the
 * derivation. Both are served without either getting in the other's way.
 */
export function FormulaDisplay({
  formulas,
  title = "The mathematics on this page",
}: {
  formulas: Formula[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!formulas?.length) return null;

  return (
    <section className="panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full panel-header hover:bg-ink-850/50 transition-colors text-left"
      >
        <h2 className="panel-title">{title}</h2>
        <span className="text-txt-tertiary text-sm shrink-0" aria-hidden="true">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="p-4 grid gap-4 md:grid-cols-2">
          {formulas.map((formula) => (
            <div key={formula.name} className="border border-ink-700/60 rounded-sm p-3">
              <p className="text-sm font-medium text-txt-primary mb-1">{formula.name}</p>
              <div className="text-signal-bright">
                <Rendered latex={formula.latex} />
              </div>
              <p className="text-xs text-txt-tertiary mt-1.5 leading-relaxed">{formula.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default FormulaDisplay;
