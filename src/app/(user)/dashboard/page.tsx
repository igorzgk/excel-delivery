export default function UserDashboard() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold">My Uploads</h2>
        <p className="text-sm text-[color:var(--muted)]">Recent files you’ve uploaded.</p>
        {/* TODO: table/list */}
      </section>
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold">Assignments</h2>
        <p className="text-sm text-[color:var(--muted)]">Files assigned to you.</p>
      </section>
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 md:col-span-2">
        <h2 className="font-semibold">Announcements</h2>
        <ul className="list-disc pl-5 text-sm text-[color:var(--muted)]">
          <li>Welcome! Your subscription status is visible in your profile.</li>
        </ul>
      </section>
    </div>
  );
}
