/** Token-based primitives for the Clawnify Apps design system (DESIGN-APPS.md):
 *  labeled zones with eyebrows, one coral action, engineered numbers, chips,
 *  tinted status badges. No raw hex — every recipe references a theme token. */
import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { Quality } from "../../shared/types";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-md border border-border bg-surface", className)}>{children}</div>
  );
}

/** A labeled zone inside a card — the signature move. Every zone opens with an
 *  eyebrow; zones after the first carry a top hairline. */
export function Zone({
  eyebrow,
  count,
  action,
  children,
  first,
  className,
}: {
  eyebrow: string;
  count?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  first?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("px-5 py-4", !first && "border-t border-border", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="eyebrow flex items-center gap-2">
          <span>{eyebrow}</span>
          {count != null && <span className="text-faint">·</span>}
          {count != null && <span className="tnum text-muted">{count}</span>}
        </div>
        {action}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  type = "button",
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const styles = {
    primary: "bg-primary text-on-primary hover:bg-primary-hover",
    secondary: "bg-surface text-foreground border border-border hover:bg-surface-sunken",
    ghost: "text-muted hover:bg-surface-sunken hover:text-foreground",
    danger: "bg-surface text-danger border border-border hover:bg-danger-tint hover:text-danger-hover",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-sm px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-sm border border-border bg-surface-sunken px-2 py-0.5 text-[11px] text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Badge({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  const styles = {
    success: "bg-success-tint text-success",
    warning: "bg-warning-tint text-warning",
    danger: "bg-danger-tint text-danger",
    neutral: "bg-surface-sunken text-muted",
  }[tone];
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold tracking-[0.04em]", styles)}>
      {children}
    </span>
  );
}

export function SideBadge({ side }: { side: "YES" | "NO" }) {
  return <Badge tone={side === "YES" ? "success" : "danger"}>{side}</Badge>;
}

export function GradeBadge({ quality }: { quality: Quality }) {
  const tone = quality.grade === "A" || quality.grade === "B" ? "success" : quality.grade === "C" ? "warning" : "neutral";
  return (
    <Chip className={clsx(tone === "success" && "border-transparent bg-success-tint text-success", tone === "warning" && "border-transparent bg-warning-tint text-warning")}>
      <span className="font-semibold">{quality.grade}</span>
      <span className="tnum">{quality.total}</span>
    </Chip>
  );
}

export function Stat({ label, value, meta }: { label: string; value: ReactNode; meta?: ReactNode }) {
  return (
    <div className="px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="tnum mt-1.5 text-2xl font-bold leading-none">{value}</div>
      <div className="mt-1 h-4 text-[11px] text-muted">{meta}</div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("animate-spin", className)} width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-[13px] text-muted">{children}</div>;
}
