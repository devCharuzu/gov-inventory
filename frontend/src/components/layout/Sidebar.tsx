import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Sparkles,
  Tags,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/AuthContext";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/items", label: "Items", icon: Package },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings/whats-new", label: "What's new", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function Sidebar({
  onOpenTutorial,
}: {
  onOpenTutorial: () => void;
}) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src="/philfida-logo.png"
            alt="PhilFIDA"
            className="h-8 w-8 shrink-0 object-contain"
          />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-base font-bold tracking-tight text-primary">
                PhilFIDA
              </p>
              <p className="truncate text-[10px] font-medium text-muted-foreground">
                Inventory System
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80",
                collapsed && "justify-center px-0"
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer: user + logout */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={onOpenTutorial}
          title={collapsed ? "Quick guide" : undefined}
          className={cn(
            "w-full text-sidebar-foreground/80 hover:text-sidebar-foreground",
            collapsed ? "h-9" : "justify-start"
          )}
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">Quick guide</span>}
        </Button>
        <div
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2",
            collapsed && "justify-center px-0"
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">
              {user ? initials(user.full_name) : "?"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && user && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.full_name}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {user.region_name}
              </p>
              <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px] uppercase">
                {user.role}
              </Badge>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={logout}
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "mt-1 w-full text-sidebar-foreground/80 hover:text-sidebar-foreground",
            collapsed ? "h-9" : "justify-start"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
