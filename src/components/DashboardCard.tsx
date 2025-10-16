"use client";
import { ReactNode } from "react";

export default function DashboardCard({
  title, value, subtitle, right, children
}:{
  title: string;
  value?: string | number;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium text-[color:var(--muted)]">{title}</h3>
          {value !== undefined && (
            <div className="text-3xl font-semibold mt-2">{value}</div>
          )}
          {subtitle && <p className="text-xs text-[color:var(--muted)] mt-1">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
