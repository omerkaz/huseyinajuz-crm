import { useLocation } from "react-router";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/patients": "Patients",
  "/pipeline": "Pipeline",
  "/payments": "Payments",
  "/surveys": "Surveys",
  "/email": "Email",
  "/settings": "Settings",
};

function usePageTitle(): string {
  const { pathname } = useLocation();
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/patients/") && pathname.endsWith("/edit")) return "Edit Patient";
  if (pathname.startsWith("/patients/new")) return "New Patient";
  if (pathname.startsWith("/patients/")) return "Patient Details";
  return "Dashboard";
}

export default function Topbar() {
  const { user, signOut } = useAuth();
  const pageTitle = usePageTitle();

  return (
    <header className="flex h-14 items-center justify-between border-b border-hairline bg-surface px-6 md:px-8">
      {/* Left — page title (pushed right on mobile to clear hamburger) */}
      <div className="pl-10 md:pl-0">
        <h2 className="display-condensed text-[0.95rem] text-ink">
          {pageTitle}
        </h2>
      </div>

      {/* Right — operator + sign-out */}
      <div className="flex items-center gap-4">
        <span className="reading hidden text-[0.72rem] text-ink-secondary sm:inline">
          {user?.email ?? "—"}
        </span>
        <Button variant="secondary" size="sm" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
