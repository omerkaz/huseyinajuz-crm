import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/context/auth";
import { Loader2 } from "lucide-react";

/**
 * Layout route that gates child routes behind authentication.
 * - Loading → centered spinner
 * - No session → redirect to /login
 * - Authenticated → render nested routes
 */
export default function RequireAuth() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
