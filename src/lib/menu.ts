export type Role = "ADMIN" | "USER";
export type MenuItem = { label: string; href: string };

export function getMenu(role: Role): MenuItem[] {
  if (role === "ADMIN") {
    return [
      { label: "Dashboard", href: "/admin" },
      { label: "Users", href: "/admin/users" },
      { label: "Files", href: "/admin/files" },
      { label: "Settings", href: "/admin/settings" },
    ];
  }
  // USER
  return [
    { label: "Dashboard", href: "/dashboard" },
    { label: "My Files", href: "/files" },
    { label: "Assignments", href: "/assignments" },
    { label: "Support", href: "/support" },
  ];
}
