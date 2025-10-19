// src/lib/menu.ts
export type Role = "ADMIN" | "USER";
export type MenuItem = { label: string; href: string };

export function getMenu(role: Role): MenuItem[] {
  if (role === "ADMIN") {
    return [
      { label: "Πίνακας Ελέγχου", href: "/dashboard/admin" },
      { label: "Χρήστες", href: "/admin/users" },
      { label: "Αρχεία", href: "/admin/files" },
      { label: "Ρυθμίσεις", href: "/admin/settings" },
      { label: "Αρχεία Καταγραφής", href: "/admin/audit" },
    ];
  }

  // USER menu (no "Αναθέσεις")
  return [
    { label: "Πίνακας Ελέγχου", href: "/dashboard" },
    { label: "Τα Αρχεία μου", href: "/files" },
    { label: "Υποστήριξη", href: "/support" },
  ];
}
