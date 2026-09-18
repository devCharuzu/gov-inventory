import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Inbox,
  Package,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppLayout, PageWrapper } from "@/components/layout";
import { DateInput, PdfDialog } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { analyticsService } from "@/lib/services/analytics.service";
import { reportsService } from "@/lib/services/reports.service";
import type {
  CategoryBreakdown,
  SummaryStats,
  TopItem,
  TrendDataPoint,
} from "@/types/analytics.types";

const GREEN = "#206027";
const ORANGE = "#ea580c";
const BLUE = "#2563eb";
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

type Period = "weekly" | "monthly" | "semester";
const PERIODS: Period[] = ["weekly", "monthly", "semester"];

interface AnalyticsData {
  summary: SummaryStats;
  trends: TrendDataPoint[];
  topOut: TopItem[];
  topIn: TopItem[];
  categories: CategoryBreakdown[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 4 + i).reverse();

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const usingRange = !!startDate && !!endDate;

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(false);
    const range = usingRange
      ? {
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
        }
      : {};

    Promise.all([
      analyticsService.getSummary(),
      analyticsService.getTrends({
        period,
        year: usingRange ? undefined : year,
        ...range,
      }),
      analyticsService.getTopItems({ type: "OUT", limit: 10, ...range }),
      analyticsService.getTopItems({ type: "IN", limit: 10, ...range }),
      analyticsService.getCategoryBreakdown(),
    ])
      .then(([summary, trends, topOut, topIn, categories]) => {
        setData({ summary, trends, topOut, topIn, categories });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [period, year, startDate, endDate, usingRange]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function exportPdf() {
    try {
      const url = await reportsService.getAnalyticsReport({ period, year });
      setPdfUrl(url);
    } catch {
      toast.error("Failed to export report");
    }
  }

  return (
    <AppLayout>
      <PageWrapper
        title="Analytics"
        subtitle="Inventory movement trends and insights"
        actions={
          <Button variant="outline" onClick={exportPdf}>
            <Download className="mr-2 h-4 w-4" />
            Export Analytics Report PDF
          </Button>
        }
      >
        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="inline-flex rounded-md border p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <Select
            value={String(year)}
            onValueChange={(v) => v && setYear(Number(v))}
            disabled={usingRange}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <DateInput
              value={startDate}
              onChange={setStartDate}
              placeholder="Start date"
              aria-label="Override start date"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <DateInput
              value={endDate}
              onChange={setEndDate}
              placeholder="End date"
              aria-label="Override end date"
            />
            {usingRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Failed to load analytics</AlertTitle>
            <AlertDescription>
              Something went wrong. Adjust the filters or try again.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <KpiRow loading={loading} summary={data?.summary} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Stock Movement Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : !data || data.trends.length === 0 ? (
                  <EmptyState message="No trend data for this range" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.trends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="period_label"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total_in" name="In" fill={GREEN} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total_out" name="Out" fill={ORANGE} radius={[4, 4, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="net"
                        name="Net"
                        stroke={BLUE}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <TopItemsChart
                title="Top 10 Most Released Items"
                color={ORANGE}
                loading={loading}
                items={data?.topOut ?? []}
              />
              <TopItemsChart
                title="Top 10 Most Received Items"
                color={GREEN}
                loading={loading}
                items={data?.topIn ?? []}
              />
            </div>

            <CategoryChart
              loading={loading}
              categories={data?.categories ?? []}
            />
          </div>
        )}
      </PageWrapper>
      <PdfDialog
        url={pdfUrl}
        onOpenChange={(o) => !o && setPdfUrl(null)}
        title="Analytics Report"
      />
    </AppLayout>
  );
}

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
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              {loading ? (
                <Skeleton className="mt-2 h-7 w-12" />
              ) : (
                <p className="mt-1 text-2xl font-bold">
                  {summary ? summary[key] : 0}
                </p>
              )}
            </div>
            <Icon className={`h-7 w-7 ${color}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TopItemsChart({
  title,
  color,
  loading,
  items,
}: {
  title: string;
  color: string;
  loading: boolean;
  items: TopItem[];
}) {
  const data = items.map((it) => ({
    name: it.item_code,
    label: it.item_name,
    qty: it.total_quantity,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : data.length === 0 ? (
          <EmptyState message="No data for this range" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={12} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                fontSize={11}
                width={72}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => [value, "Qty"]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.label ?? ""
                }
              />
              <Bar dataKey="qty" fill={color} radius={[0, 4, 4, 0]} />
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
        <CardTitle className="text-base">Category Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
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
                outerRadius={100}
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Inbox className="h-8 w-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
