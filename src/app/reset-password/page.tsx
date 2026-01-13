import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <p className="text-sm text-[color:var(--muted)]">Φόρτωση…</p>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
