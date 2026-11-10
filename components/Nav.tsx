"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const ITEMS = [
  { href: "/", label: "Today", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { href: "/board", label: "Board", icon: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v12h-4z" },
  { href: "/list", label: "List", icon: "M4 6h16M4 12h16M4 18h16" },
  { href: "/stats", label: "Stats", icon: "M5 20V10M12 20V4M19 20v-7" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Nav({ logout }: { logout: React.ReactNode }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      {/* Laptop: left sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-52 flex-col gap-1 border-r border-line bg-surface p-3">
        <div className="px-3 py-3 text-lg font-bold">Job Tracker</div>
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${active(i.href) ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>
            <Icon d={i.icon} /> {i.label}
          </Link>
        ))}
        <Link href="/new" className="btn btn-primary mt-3">+ Add job</Link>
        <div className="mt-auto space-y-2"><ThemeToggle />{logout}</div>
      </aside>

      {/* Phone: small top bar with the theme toggle and log out */}
      <div className="md:hidden flex items-center justify-between gap-2 px-4 pt-3">
        <span className="font-bold">Job Tracker</span>
        <div className="flex items-center gap-2 [&_button]:w-auto"><ThemeToggle compact />{logout}</div>
      </div>

      {/* Phone: bottom tabs and a floating add button */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-line bg-surface safe-bottom">
        <div className="grid grid-cols-4">
          {ITEMS.map((i) => (
            <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active(i.href) ? "text-accent" : "text-muted"}`}>
              <Icon d={i.icon} /> {i.label}
            </Link>
          ))}
        </div>
      </nav>
      {path !== "/new" && (
        <Link href="/new" aria-label="Add job"
          className="md:hidden fixed right-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-ink text-3xl shadow-lg"
          style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}>
          +
        </Link>
      )}
    </>
  );
}
