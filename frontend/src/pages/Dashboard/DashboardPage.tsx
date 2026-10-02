import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Inbox,
  Package,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

import { AppLayout, PageWrapper } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { analyticsService } from "@/lib/services/analytics.service";
import { itemsService } from "@/lib/services/items.service";
import { transactionsService } from "@/lib/services/transactions.service";
import type {
  CategoryBreakdown,
  SummaryStats,
  TrendDataPoint,
} from "@/types/analytics.types";
import type { Item } from "@/types/item.types";
import type { Transaction } from "@/types/transaction.types";

const GREEN = "#16a34a";
const ORANGE = "#ea580c";
const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
];

interface DashboardData {
  summary: SummaryStats;
  trends: TrendDataPoint[];
  categories: CategoryBreakdown[];
  recent: Transaction[];
  lowStock: Item[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const year = new Date().getFullYear();
    setLoading(true);
    setError(false);

    Promise.all([
      analyticsService.getSummary(),
      analyticsService.getTrends({ period: "monthly", year }),
      analyticsService.getCategoryBreakdown(),
      transactionsService.getTransactions({ page: 1, size: 10 }),
      itemsService.getLowStock(),
    ])
      .then(([summary, trends, categories, txns, lowStock]) => {
        if (!active) return;
        setData({
          summary,
          trends,
          categories,
          recent: txns.items,
          lowStock,
        });
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppLayout>
      <PageWrapper
        title="Dashboard"
        subtitle="Overview of inventory activity and stock status"
      >
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Failed to load dashboard</AlertTitle>
            <AlertDescription>
              Something went wrong while fetching data. Please refresh the page.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <KpiRow loading={loading} summary={data?.summary} />
            <div className="grid gap-6 lg:grid-cols-2">
              <MovementChart loading={loading} trends={data?.trends ?? []} />
              <CategoryChart
                loading={loading}
                categories={data?.categories ?? []}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <RecentTransactions
                loading={loading}
                transactions={data?.recent ?? []}
              />
              <LowStockList loading={loading} items={data?.lowStock ?? []} />
            </div>
          </div>
        )}
      </PageWrapper>
    </AppLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Row 1 — KPI cards                                                          */
/* -------------------------------------------------------------------------- */
interface KpiDef {
  key: keyof SummaryStats;
  label: string;
  icon: LucideIcon;
  color: string;
}

const KPIS: KpiDef[] = [
  { key: "total_items", label: "Total Items", icon: Package, color: "text-blue-600" },
  { key: "total_in_today", label: "In Today", icon: ArrowDownCircle, color: "text-green-600" },
  { key: "total_out_today", label: "Out Today", icon: ArrowUpCircle, color: "text-orange-600" },
  { key: "low_stock_count", label: "Low Stock", icon: AlertTriangle, color: "text-red-600" },
];

function KpiRow({
  loading,
  summary,
}: {
  loading: boolean;
  summary?: SummaryStats;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPIS.map(({ key, label, icon: Icon, color }) => (
        <Card key={key}>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className="mt-1 text-3xl font-bold">
                  {summary ? summary[key] : 0}
                </p>
              )}
            </div>
            <Icon className={`h-8 w-8 ${color}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row 2 — charts                                                            */
/* -------------------------------------------------------------------------- */
function monthLabel(periodLabel: string): string {
  // periodLabel like "2026-01"; render as "Jan".
  const [y, m] = periodLabel.split("-").map(Number);
  if (!y || !m) return periodLabel;
  return format(new Date(y, m - 1, 1), "MMM");
}

function MovementChart({
  loading,
  trends,
}: {
  loading: boolean;
  trends: TrendDataPoint[];
}) {
  const last6 = trends.slice(-6).map((t) => ({
    month: monthLabel(t.period_label),
    In: t.total_in,
    Out: t.total_out,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Stock Movement</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : last6.length === 0 ? (
          <EmptyState message="No movement data yet" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last6}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={12} tickLine={false} />
              <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="In" fill={GREEN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Out" fill={ORANGE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryChart({
  loading,
  categories,
}: {
  loading: boolean;
  categories: CategoryBreakdown[];
}) {
  const slices = categories
    .filter((c) => c.item_count > 0)
    .map((c) => ({ name: c.category_name, value: c.item_count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stock by Category</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : slices.length === 0 ? (
          <EmptyState message="No categories to display" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={80}
                label
              >
                {slices.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Row 3 — recent transactions + low stock                                   */
/* -------------------------------------------------------------------------- */
function RecentTransactions({
  loading,
  transactions,
}: {
  loading: boolean;
  transactions: Transaction[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState message="No transactions recorded" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref No.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">
                    {t.reference_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.transaction_type === "IN" ? "default" : "secondary"
                      }
                    >
                      {t.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate">
                    {t.item?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">{t.quantity}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {format(new Date(t.transaction_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-xs">
                    {t.creator?.full_name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LowStockList({
  loading,
  items,
}: {
  loading: boolean;
  items: Item[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Low Stock Items</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState message="No items are low on stock" />
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/items/${item.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.code}</p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    {item.quantity} / {item.minimum_quantity}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared                                                                    */
/* -------------------------------------------------------------------------- */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
      <Inbox className="h-8 w-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
