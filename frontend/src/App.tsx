import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";

import ProtectedRoute from "@/components/shared/ProtectedRoute";
import { AuthProvider } from "@/store/AuthContext";

import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import {
  ItemsPage,
  AddItemPage,
  EditItemPage,
  ItemDetailPage,
} from "@/pages/Items";
import {
  TransactionsPage,
  NewInTransactionPage,
  NewOutTransactionPage,
} from "@/pages/Transactions";
import { AnalyticsPage } from "@/pages/Analytics";
import { CategoriesPage } from "@/pages/Categories";
import { ReportsPage } from "@/pages/Reports";
import { SettingsPage } from "@/pages/Settings";
import WhatsNewPage from "@/pages/WhatsNew/WhatsNewPage";

const ENCODER_ROLES = ["encoder", "admin"];
const ADMIN_ROLES = ["admin"];

// Keeps toast notifications on the same theme as the app by watching the
// `dark` class that ThemeToggle flips on <html>.
function ThemedToaster() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return <Toaster richColors position="top-center" theme={theme} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items"
            element={
              <ProtectedRoute>
                <ItemsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/new"
            element={
              <ProtectedRoute requiredRoles={ENCODER_ROLES}>
                <AddItemPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/:id/edit"
            element={
              <ProtectedRoute requiredRoles={ADMIN_ROLES}>
                <EditItemPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/:id"
            element={
              <ProtectedRoute>
                <ItemDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <TransactionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions/in"
            element={
              <ProtectedRoute requiredRoles={ENCODER_ROLES}>
                <NewInTransactionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions/out"
            element={
              <ProtectedRoute requiredRoles={ENCODER_ROLES}>
                <NewOutTransactionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredRoles={ADMIN_ROLES}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/whats-new"
            element={
              <ProtectedRoute>
                <WhatsNewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/whats-new/:slug"
            element={
              <ProtectedRoute>
                <WhatsNewPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ThemedToaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
