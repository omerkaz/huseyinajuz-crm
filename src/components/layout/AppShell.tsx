import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/**
 * Top-level authenticated layout: sidebar + topbar + content area.
 * Rendered inside RequireAuth so it only shows for authenticated users.
 */
export default function AppShell() {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />

      {/* Main column: topbar + scrollable content.
          min-w-0 lets wide content (e.g. Pipeline channels) scroll inside
          overflow-x-auto instead of stretching the layout. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
