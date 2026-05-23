import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-14 z-20 flex flex-col gap-3 border-b border-border bg-background/85 px-4 py-4 backdrop-blur sm:top-16 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-8 sm:pb-28 sm:pt-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40",
        accent && "border-primary/30 bg-gradient-to-br from-primary/10 to-transparent",
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "num mt-2 font-display text-2xl font-bold leading-none sm:text-3xl",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-5">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
