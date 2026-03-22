"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, clearToken } from "@/lib/auth";

const NO_SHELL_PATHS = ["/login", "/embed"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const isNoShell = NO_SHELL_PATHS.some((p) => pathname.startsWith(p));
  const isPublic = isNoShell || pathname.startsWith("/curation");

  useEffect(() => {
    if (!isPublic && !isAuthenticated()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [pathname, router, isPublic]);

  // Login & embed pages: no sidebar, no auth check
  if (isNoShell) {
    return <>{children}</>;
  }

  // Public pages (curation): show minimal nav
  if (pathname.startsWith("/curation") && !pathname.startsWith("/curation/admin")) {
    return <>{children}</>;
  }

  // Auth-protected pages: show sidebar
  if (!ready) return null;

  return (
    <div className="min-h-screen flex">
      <Sidebar pathname={pathname} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const router = useRouter();

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col">
      <h1 className="text-lg font-bold text-white mb-8">myFuckingMusic</h1>

      <nav className="flex flex-col gap-1 flex-1">
        <NavLink href="/" active={pathname === "/"}>Dashboard</NavLink>
        <NavLink href="/users" active={pathname === "/users"}>Users</NavLink>
        <NavLink href="/invitations" active={pathname === "/invitations"}>Invitations</NavLink>

        <div className="mt-4 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Billing</span>
        </div>
        <NavLink href="/features" active={pathname === "/features"}>Feature Matrix</NavLink>
        <NavLink href="/plans" active={pathname === "/plans"}>Plans & Pricing</NavLink>
        <NavLink href="/subscriptions" active={pathname === "/subscriptions"}>Subscriptions</NavLink>

        <div className="mt-4 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Engagement</span>
        </div>
        <NavLink href="/curation/admin" active={pathname.startsWith("/curation/admin")}>Song Curation</NavLink>
        <NavLink href="/charts" active={pathname === "/charts"}>Chart Alerts</NavLink>
      </nav>

      <button
        onClick={() => {
          clearToken();
          router.push("/login");
        }}
        className="mt-4 px-3 py-2 text-sm text-zinc-500 hover:text-red-400 transition-colors text-left"
      >
        Log out
      </button>
    </aside>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-zinc-800 text-white font-medium"
          : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
      }`}
    >
      {children}
    </Link>
  );
}
