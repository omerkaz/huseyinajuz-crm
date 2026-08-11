import { NavLink } from "react-router";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Funnel,
  CreditCard,
  ClipboardList,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/funnel", label: "Funnel", icon: Funnel },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/surveys", label: "Surveys", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-[6px] border border-hairline bg-surface p-2 md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5 text-ink" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel — flat faceplate, hairline-ruled */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-hairline bg-surface
          transition-transform duration-200 ease-out
          md:relative md:z-auto md:translate-x-0
          ${mobileOpen ? "translate-x-0 shadow-float" : "-translate-x-full md:shadow-none"}
        `}
      >
        {/* Wordmark */}
        <div className="flex items-center justify-between border-b border-hairline px-5 py-5">
          <div>
            <h1 className="display-condensed text-[1.05rem] text-ink">
              Hüseyin Ajuz
            </h1>
            <p className="scale-label mt-0.5 text-ink-secondary">
              Patient Instrument
            </p>
          </div>
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-[6px] p-1 text-ink-secondary hover:text-ink md:hidden"
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
                    `flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[0.8rem] font-semibold uppercase tracking-[0.05em] [font-stretch:87.5%] transition-colors duration-150 ${
                      isActive
                        ? "bg-ink text-white"
                        : "text-ink-secondary hover:bg-ink-wash hover:text-ink"
                    }`
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-hairline px-5 py-3">
          <p className="reading text-[0.65rem] text-ink-muted">
            © 2026 Hüseyin Ajuz
          </p>
        </div>
      </aside>
    </>
  );
}
