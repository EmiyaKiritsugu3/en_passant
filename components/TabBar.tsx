"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Swords, Brain, User } from "lucide-react";

const TABS = [
  { href: "/", label: "Aprender", icon: GraduationCap, match: (p: string) => p === "/" || p.startsWith("/study") },
  { href: "/play", label: "Jogar", icon: Swords, match: (p: string) => p.startsWith("/play") },
  { href: "/train", label: "Revisar", icon: Brain, match: (p: string) => p.startsWith("/train") },
  {
    href: "/dashboard",
    label: "Você",
    icon: User,
    match: (p: string) => p.startsWith("/dashboard"),
  },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-noir-line bg-white/80 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-lg grid grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? "text-bronze" : "text-noir-muted"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
