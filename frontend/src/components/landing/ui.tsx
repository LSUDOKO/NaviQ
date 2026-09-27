import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Narrow centred content frame shared by every landing section. */
export function Wrap({ children, className = "", width = "max-w-[1120px]" }: { children: ReactNode; className?: string; width?: string }) {
  return <div className={`mx-auto w-full px-4 sm:px-6 ${width} ${className}`}>{children}</div>;
}

/** Small blue link-styled eyebrow, optionally with a trailing chevron. */
export function Eyebrow({ children, to, className = "" }: { children: ReactNode; to?: string; className?: string }) {
  const inner = (
    <span className={`inline-flex items-center gap-1 text-[13px] font-medium text-signal ${className}`}>
      {children}
      {to && <Chevron />}
    </span>
  );
  return to ? <Link to={to} className="hover:opacity-80 transition-opacity">{inner}</Link> : inner;
}

export function Chevron({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  );
}

/** Compact black pill CTA. */
export function BlackButton({ children, to, href, className = "", size = "md" }: { children: ReactNode; to?: string; href?: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const pad = size === "lg" ? "h-12 px-6 text-[15px]" : size === "sm" ? "h-9 px-4 text-[13px]" : "h-10 px-5 text-[14px]";
  const cls = `inline-flex items-center justify-center gap-2 rounded-full bg-[#0B0D0F] text-white font-medium hover:bg-[#26292D] transition-colors ${pad} ${className}`;
  if (href) return <a href={href} className={cls} target="_blank" rel="noreferrer">{children}</a>;
  return <Link to={to ?? "/app"} className={cls}>{children}</Link>;
}

export function WhiteButton({ children, to, className = "" }: { children: ReactNode; to: string; className?: string }) {
  return (
    <Link to={to} className={`inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full bg-white border border-[#E8E8E8] text-[13px] font-medium text-[#0B0D0F] hover:border-[#D0D3D8] transition-colors ${className}`}>
      {children}
    </Link>
  );
}

/** A screenshot inside a light browser chrome. */
export function BrowserFrame({ src, alt, url = "naviq.pages.dev/app", className = "", imgClassName = "" }: { src: string; alt: string; url?: string; className?: string; imgClassName?: string }) {
  return (
    <figure className={`browser-frame ${className}`}>
      <div className="flex items-center gap-3 h-9 px-3.5 border-b border-[#EFEFEF] bg-[#FAFAFA]">
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><i className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><i className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </span>
        <span className="flex-1 max-w-xs mx-auto h-6 rounded-md bg-white border border-[#EDEDED] text-[11px] text-[#9BA0A6] flex items-center justify-center truncate px-3">{url}</span>
      </div>
      <img src={src} alt={alt} loading="lazy" className={imgClassName} />
    </figure>
  );
}

/** Bold lead sentence followed by muted supporting copy. */
export function LeadCopy({ lead, children, className = "" }: { lead: string; children: ReactNode; className?: string }) {
  return (
    <p className={`text-[14px] leading-[1.6] ${className}`}>
      <span className="font-semibold text-[#0B0D0F]">{lead}</span>{" "}
      <span className="text-[#70757A]">{children}</span>
    </p>
  );
}

/** Centred heading block: eyebrow, large statement, optional subtitle. */
export function SectionHead({ eyebrow, eyebrowTo, title, sub, align = "center", size = "lg" }: { eyebrow?: string; eyebrowTo?: string; title: ReactNode; sub?: ReactNode; align?: "center" | "left"; size?: "lg" | "md" }) {
  const a = align === "center" ? "text-center items-center" : "text-left items-start";
  const t = size === "lg" ? "text-[34px] sm:text-[44px] lg:text-[48px] leading-[1.06]" : "text-[26px] sm:text-[30px] leading-[1.12]";
  return (
    <div className={`flex flex-col ${a} gap-4`}>
      {eyebrow && <Eyebrow to={eyebrowTo}>{eyebrow}</Eyebrow>}
      <h2 className={`font-semibold ${t} max-w-[760px]`}>{title}</h2>
      {sub && <div className="text-[15px] leading-[1.65] text-[#70757A] max-w-[560px]">{sub}</div>}
    </div>
  );
}

export const ArrowDown = (
  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 2.5v9M4.5 8 8 11.5 11.5 8M3 13.5h10" />
  </svg>
);
