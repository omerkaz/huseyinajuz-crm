import { NavLink } from "react-router";
import {
  LayoutDashboard,
  Users,
  Kanban,
  CreditCard,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-surface p-2 shadow-warm md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5 text-text" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface shadow-warm-lg
          transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          md:relative md:z-auto md:translate-x-0 md:shadow-warm
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-divider px-6 py-5">
          <div>
            <h1 className="font-heading text-xl text-text leading-tight">
              Hüseyin Ajuz
            </h1>
            <p className="text-xs text-text-secondary tracking-wide">
              Patient CRM
            </p>
          </div>
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1 text-text-secondary hover:text-text md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-[var(--radius-inner)] px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "bg-teal text-white shadow-[0_2px_8px_var(--color-teal-glow)]"
                        : "text-text-secondary hover:bg-[rgba(42,157,143,0.08)] hover:text-text"
                    }`
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-divider px-6 py-3">
          <p className="text-[11px] text-text-muted">© 2026 Hüseyin Ajuz</p>
        </div>
      </aside>
    </>
  );
}
