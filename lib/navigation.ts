export type CreatorNavItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
};

export type CreatorNavSection = {
  label: string;
  items: CreatorNavItem[];
};

export const creatorNavigation: CreatorNavSection[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", description: "Your work at a glance", icon: "⌂" },
      { href: "/shows", label: "Shows", description: "Manage your catalog", icon: "◉" },
      { href: "/episodes", label: "Episodes", description: "Plan and organize episodes", icon: "▤" },
    ],
  },
  {
    label: "Create",
    items: [
      { href: "/studio", label: "Record / Edit", description: "Create in browser or Studio", icon: "◫" },
      { href: "/publish", label: "Publish", description: "RSS, players, and distribution", icon: "↗" },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/analytics", label: "Analytics", description: "Audience and performance", icon: "⌁" },
      { href: "/team", label: "Team", description: "Invite collaborators", icon: "◎" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings", label: "Settings / Billing", description: "Profile, plan, and payments", icon: "⚙" },
    ],
  },
];

export function isCreatorNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/studio") {
    return pathname === "/studio" || pathname === "/editor" || /^\/episodes\/[^/]+\/(studio|editor|live-studio)$/.test(pathname);
  }
  if (href === "/publish") return pathname === "/publish" || /^\/episodes\/[^/]+\/publish$/.test(pathname);
  if (href === "/team") return pathname === "/team" || /^\/shows\/[^/]+\/team$/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}
