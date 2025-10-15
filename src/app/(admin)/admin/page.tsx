export default function AdminDashboard() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold">Usage</h2>
        <p className="text-sm text-[color:var(--muted)]">Daily uploads / users.</p>
      </section>
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold">Pending Approvals</h2>
        <p className="text-sm text-[color:var(--muted)]">Review new user requests.</p>
      </section>
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold">System Health</h2>
        <p className="text-sm text-[color:var(--muted)]">All systems operational.</p>
      </section>

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 lg:col-span-3">
        <h2 className="font-semibold">Recent Activity</h2>
        <p className="text-sm text-[color:var(--muted)]">Audit log preview here.</p>
      </section>
    </div>
  );
}
