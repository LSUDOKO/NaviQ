import type { ReactNode } from "react";

interface PanelProps {
  id?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /**
   * Panels are not all the same kind of object. `raised` is for the thing a
   * page is actually about, `inset` for a readout nested inside another panel,
   * `plain` for everything else. Giving all three the same border and shadow is
   * the tell of a template.
   */
  weight?: "plain" | "raised" | "inset";
}

export function Panel({
  id,
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
  weight = "plain",
}: PanelProps) {
  const surface =
    weight === "raised" ? "panel-raised" : weight === "inset" ? "panel-inset" : "panel";

  return (
    <section id={id} className={`${surface} ${className}`}>
      {(title || actions) && (
        <header className="panel-header">
          <div className="min-w-0">
            {title && <h2 className="panel-title truncate">{title}</h2>}
            {subtitle && <p className="panel-subtitle truncate">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export default Panel;
