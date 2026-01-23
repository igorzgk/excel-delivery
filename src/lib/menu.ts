// src/lib/menu.ts
export type Role = "ADMIN" | "USER";
export type MenuItem = { label: string; href: string };

export function getMenu(role: Role): MenuItem[] {
  if (role === "ADMIN") {
    return [
      { label: "Πίνακας Ελέγχου", href: "/admin" },
      { label: "Χρήστες", href: "/admin/users" },
      { label: "Αρχεία", href: "/admin/files" },
      { label: "Υποστήριξη", href: "/admin/support" }, // ← add this
      { label: "Αρχεία Καταγραφής", href: "/admin/audit" },
      { label: "Φάκελοι", href: "/admin/pdf-folders" },
    ];
  }

  return [
    { label: "Πίνακας Ελέγχου", href: "/dashboard" },
    { label: "Τα Αρχεία μου", href: "/files" },
    { label: "Υποστήριξη", href: "/support" },
    { label: "Προφίλ", href: "/profile" },
  ];
}
