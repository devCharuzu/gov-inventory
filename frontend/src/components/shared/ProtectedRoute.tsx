import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/store/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

export default function ProtectedRoute({
  children,
  requiredRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Wait for session rehydration before deciding where to send the user.
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    toast.error("Not authorized");
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
