"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ----------------------------- Button ----------------------------- */
type ButtonVariant = "primary" | "outline" | "ghost" | "soft" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-2 shadow-[0_6px_20px_-8px_rgba(236,19,32,0.7)]",
  outline: "border border-line-2 text-fg hover:bg-surface-2 hover:border-faint",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  soft: "bg-surface-3 text-fg hover:bg-line-2",
  danger: "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        "disabled:opacity-45 disabled:pointer-events-none select-none",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

/* ----------------------------- Card ------------------------------- */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl2)] border border-line bg-surface shadow-[0_1px_2px_rgba(16,18,27,0.04),0_10px_26px_-18px_rgba(16,18,27,0.14)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ----------------------------- Badge ------------------------------ */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "teal" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-3 text-muted border-line-2",
    accent: "bg-accent-soft text-accent-2 border-accent/30",
    teal: "bg-teal-soft text-teal border-teal/30",
    warn: "bg-warn/10 text-warn border-warn/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------- Segmented --------------------------- */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 min-w-fit rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-accent/50 bg-accent-soft text-fg"
                : "border-line bg-surface-2 text-muted hover:text-fg hover:border-line-2",
            )}
          >
            <span className="block">{o.label}</span>
            {o.hint && (
              <span className={cn("block text-[11px]", active ? "text-accent-2" : "text-faint")}>
                {o.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------- Toggle ----------------------------- */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm text-fg"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
      {label}
    </button>
  );
}

/* ---------------------------- Progress ---------------------------- */
export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-teal transition-[width] duration-300"
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* --------------------------- EmptyState --------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
  art,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Up to 3 example-image URLs shown as a fanned collage instead of the icon. */
  art?: string[];
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl2)] border border-dashed border-line-2 bg-surface/40 px-6 py-16 text-center">
      {art && art.length > 0 ? (
        <div className="mb-5 flex items-center justify-center">
          {art.slice(0, 3).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              className={cn(
                "rounded-xl border border-line object-cover shadow-[0_8px_20px_-10px_rgba(16,18,27,0.4)]",
                i === 1
                  ? "z-10 h-24 w-24"
                  : "h-20 w-20 opacity-90 " + (i === 0 ? "translate-x-3 -rotate-6" : "-translate-x-3 rotate-6"),
              )}
            />
          ))}
        </div>
      ) : (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-3 text-accent-2">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------ Modal ----------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        className={cn(
          // Cap height to the viewport (dvh handles mobile browser chrome) and
          // lay out as a column so the body scrolls while header/footer stay put.
          // On mobile it docks to the bottom as a rounded sheet; centered on desktop.
          "animate-rise relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line-2 bg-surface shadow-2xl",
          "rounded-t-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl",
          widths[size],
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold text-fg">{title}</h2>
            <button
              onClick={onClose}
              className="-mr-1.5 flex h-8 w-8 items-center justify-center text-faint transition-colors hover:text-fg"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-surface-2/50 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Input ----------------------------- */
export function TextInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        // 16px on mobile stops iOS from auto-zooming on focus; back to 14px at sm+.
        "h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base text-fg sm:h-10 sm:text-sm",
        "placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20",
        className,
      )}
      {...props}
    />
  );
}
