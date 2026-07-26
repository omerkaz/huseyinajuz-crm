import { createBrowserRouter } from "react-router";
import RequireAuth from "@/components/layout/RequireAuth";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import PatientsPage from "@/pages/PatientsPage";
import PatientFormPage from "@/pages/PatientFormPage";
import PatientDetailPage from "@/pages/PatientDetailPage";
import PaymentsPage from "@/pages/PaymentsPage";
import PipelinePage from "@/pages/PipelinePage";
import SettingsPage from "@/pages/SettingsPage";
import DiagramsPage from "@/pages/DiagramsPage";
import DiagramViewPage from "@/pages/DiagramViewPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: "/",
            element: <DashboardPage />,
          },
          {
            path: "/patients",
            element: <PatientsPage />,
          },
          {
            path: "/patients/new",
            element: <PatientFormPage />,
          },
          {
            path: "/patients/:id",
            element: <PatientDetailPage />,
          },
          {
            path: "/patients/:id/edit",
            element: <PatientFormPage />,
          },
          {
            path: "/pipeline",
            element: <PipelinePage />,
          },
          {
            path: "/payments",
            element: <PaymentsPage />,
          },
          {
            path: "/diagrams",
            element: <DiagramsPage />,
          },
          {
            path: "/diagrams/:slug",
            element: <DiagramViewPage />,
          },
          {
            path: "/settings",
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
]);
