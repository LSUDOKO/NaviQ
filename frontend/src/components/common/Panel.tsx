import type { ReactNode } from "react";

interface PanelProps {
  id?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** An instrument panel: a bordered console face, not a floating card. */
export function Panel({
  id,
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
}: PanelProps) {
  return (
    <section id={id} className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-header">
          <div className="min-w-0">
            {title && <h2 className="panel-title truncate">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export default Panel;
