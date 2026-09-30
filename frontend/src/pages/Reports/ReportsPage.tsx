import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Inbox,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { toast } from "sonner";

import { AppLayout, PageWrapper } from "@/components/layout";
import { ConfirmDialog } from "@/components/shared";
import {
  DateInput,
  ItemCombobox,
  PDFPreview,
  TransactionRefCombobox,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  reportsService,
  type StoredReport,
} from "@/lib/services/reports.service";
import { EMPLOYEE_UNITS } from "@/lib/employee-units";
import { cn } from "@/lib/utils";
import type { Item } from "@/types/item.types";
import type { Transaction, TransactionType } from "@/types/transaction.types";

// ── Date preset helpers ──────────────────────────────────────────────────────
type DatePreset = "week" | "month" | "year" | "custom";

const PRESET_LABELS: Record<DatePreset, string> = {
  week: "This Week",
  month: "This Month",
  year: "This Year",
  custom: "Custom Range",
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function presetDates(preset: DatePreset): { start: string; end: string } | null {
  const now = new Date();
  if (preset === "week")
    return { start: iso(startOfWeek(now, { weekStartsOn: 1 })), end: iso(endOfWeek(now, { weekStartsOn: 1 })) };
  if (preset === "month")
    return { start: iso(startOfMonth(now)), end: iso(endOfMonth(now)) };
  if (preset === "year")
    return { start: iso(startOfYear(now)), end: iso(endOfYear(now)) };
  return null;
}

// ── Shared date filter ───────────────────────────────────────────────────────
interface DateFilter {
  preset: DatePreset | undefined;
  start: string;
  end: string;
}

const EMPTY_FILTER: DateFilter = { preset: undefined, start: "", end: "" };

function DateFilterBar({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (f: DateFilter) => void;
}) {
  function applyPreset(p: DatePreset) {
    const dates = presetDates(p);
    onChange({ preset: p, start: dates?.start ?? value.start, end: dates?.end ?? value.end });
  }

  function clear() {
    onChange(EMPTY_FILTER);
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Date Range
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {(["week", "month", "year", "custom"] as DatePreset[]).map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              value.preset === p
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
        {value.preset && (
          <button
            onClick={clear}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {value.preset === "custom" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">From</Label>
            <DateInput
              value={value.start}
              onChange={(v) => onChange({ ...value, start: v })}
              placeholder="Start date"
              className="h-8 w-38 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">To</Label>
            <DateInput
              value={value.end}
              onChange={(v) => onChange({ ...value, end: v })}
              placeholder="End date"
              className="h-8 w-38 text-sm"
            />
          </div>
        </div>
      )}

      {value.preset && value.preset !== "custom" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {value.start} → {value.end}
        </p>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeReportAction, setActiveReportAction] = useState<string | null>(null);
  const reportActionLock = useRef(false);

  // Centralized date filter (shared across Generate tab)
  const [dateFilter, setDateFilter] = useState<DateFilter>(EMPTY_FILTER);

  // Generate tab – per-report selections
  const [outTxn, setOutTxn] = useState<Transaction | null>(null);
  const [inTxn, setInTxn] = useState<Transaction | null>(null);
  const [histType, setHistType] = useState<string | undefined>(undefined);
  const [histItem, setHistItem] = useState<Item | null>(null);
  const [histEmployee, setHistEmployee] = useState("");
  const [histUnit, setHistUnit] = useState("");
  const [stockCardItem, setStockCardItem] = useState<Item | null>(null);
  // Stored documents tab
  const [stored, setStored] = useState<StoredReport[]>([]);
  const [storedLoading, setStoredLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const storedRequestId = useRef(0);

  const fetchStored = useCallback(() => {
    const activeRequest = ++storedRequestId.current;
    setStoredLoading(true);
    reportsService
      .listStoredReports()
      .then((list) => {
        if (activeRequest !== storedRequestId.current) return;
        setStored(list);
        setSelected(new Set());
      })
      .catch(() => {
        if (activeRequest === storedRequestId.current) toast.error("Failed to load stored documents");
      })
      .finally(() => {
        if (activeRequest === storedRequestId.current) setStoredLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchStored();
    return () => {
      storedRequestId.current += 1;
    };
  }, [fetchStored]);

  const filteredStored = stored.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  // Preview / download helpers
  async function runReportAction(action: string, run: () => Promise<void>) {
    if (reportActionLock.current) return;
    reportActionLock.current = true;
    setActiveReportAction(action);
    try {
      await run();
    } finally {
      reportActionLock.current = false;
      setActiveReportAction(null);
    }
  }

  async function preview(loader: () => Promise<string>, action: string) {
    await runReportAction(action, async () => {
      setPreviewLoading(true);
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      try {
        setPreviewUrl(await loader());
        previewRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch {
        toast.error("Failed to generate report");
      } finally {
        setPreviewLoading(false);
      }
    });
  }

  async function download(
    loader: () => Promise<string>,
    filename: string,
    action: string
  ) {
    await runReportAction(action, async () => {
      try {
        const url = await loader();
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch {
        toast.error("Failed to download report");
      }
    });
  }

  // Date params derived from filter
  const dateParams = {
    start_date: dateFilter.start
      ? new Date(`${dateFilter.start}T00:00:00`).toISOString()
      : undefined,
    end_date: dateFilter.end
      ? new Date(`${dateFilter.end}T23:59:59.999`).toISOString()
      : undefined,
  };
  const invalidDateRange = !!dateFilter.start && !!dateFilter.end && dateFilter.start > dateFilter.end;

  // Stored-doc helpers
  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === filteredStored.length
        ? new Set()
        : new Set(filteredStored.map((f) => f.name))
    );
  }

  async function handleDeleteOne() {
    if (!deleteTarget) return;
    try {
      await reportsService.deleteStoredReport(deleteTarget);
      toast.success("Document deleted");
      fetchStored();
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleDeleteSelected() {
    try {
      const count = await reportsService.deleteStoredReports([...selected]);
      toast.success(`${count} document${count === 1 ? "" : "s"} deleted`);
      fetchStored();
    } catch {
      toast.error("Failed to delete documents");
    } finally {
      setDeletingBulk(false);
    }
  }

  return (
    <AppLayout>
      <PageWrapper
        title="Reports"
        subtitle="Generate and view official PDF documents"
      >
        <Tabs defaultValue="generate">
          <TabsList className="mb-6">
            <TabsTrigger value="generate">
              <FileText className="mr-2 h-4 w-4" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="documents">
              <Search className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
          </TabsList>

          {/* ── Generate tab ─────────────────────────────────────────────── */}
          <TabsContent value="generate" className="space-y-6">
            {/* Centralized date filter */}
            <DateFilterBar value={dateFilter} onChange={setDateFilter} />

            <div className="grid gap-6 lg:grid-cols-2">
              <ReportCard
                title="Stock Card"
                description="Appendix 38 · Receipts, issues, and running balances on long bond paper (8.5 × 13 in)."
              >
                <div className="space-y-2">
                  <Label>Item</Label>
                  <ItemCombobox
                    value={stockCardItem?.id}
                    selectedLabel={stockCardItem ? `${stockCardItem.code} — ${stockCardItem.name}` : undefined}
                    onSelect={setStockCardItem}
                    includeInactive
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Uses the date filter above. Earlier stock is included in the opening balance.
                </p>
                {invalidDateRange && <p className="text-sm text-destructive" role="alert">Start date must be on or before end date.</p>}
                <ReportActions
                  disabled={!stockCardItem || invalidDateRange}
                  actionKey="stock-card"
                  activeAction={activeReportAction}
                  onPreview={() => stockCardItem && preview(
                    () => reportsService.getStockCard({ item_id: stockCardItem.id, ...dateParams }),
                    "stock-card-preview"
                  )}
                  onDownload={() => stockCardItem && download(
                    () => reportsService.getStockCard({ item_id: stockCardItem.id, ...dateParams }),
                    `stock-card-${stockCardItem.code}.pdf`,
                    "stock-card-download"
                  )}
                />
              </ReportCard>
              {/* Request Form (OUT) */}
              <ReportCard
                title="Request Form"
                description="Requisition & issue slip for a stock-out transaction."
              >
                <div className="space-y-2">
                  <Label>Release Transaction</Label>
                  <TransactionRefCombobox
                    type="OUT"
                    value={outTxn?.id}
                    onSelect={setOutTxn}
                  />
                </div>
                <ReportActions
                  disabled={!outTxn}
                  actionKey="request-form"
                  activeAction={activeReportAction}
                  onPreview={() => outTxn &&
                    preview(
                      () => reportsService.getRequestForm(outTxn.id),
                      "request-form-preview"
                    )}
                  onDownload={() =>
                    outTxn &&
                    download(
                      () => reportsService.getRequestForm(outTxn.id),
                      `request-form-${outTxn.reference_number}.pdf`,
                      "request-form-download"
                    )
                  }
                />
              </ReportCard>

              {/* Received Form (IN) */}
              <ReportCard
                title="Received Form"
                description="Inventory receiving report for a stock-in transaction."
              >
                <div className="space-y-2">
                  <Label>Receiving Transaction</Label>
                  <TransactionRefCombobox
                    type="IN"
                    value={inTxn?.id}
                    onSelect={setInTxn}
                  />
                </div>
                <ReportActions
                  disabled={!inTxn}
                  actionKey="received-form"
                  activeAction={activeReportAction}
                  onPreview={() => inTxn &&
                    preview(
                      () => reportsService.getReceivedForm(inTxn.id),
                      "received-form-preview"
                    )}
                  onDownload={() =>
                    inTxn &&
                    download(
                      () => reportsService.getReceivedForm(inTxn.id),
                      `received-form-${inTxn.reference_number}.pdf`,
                      "received-form-download"
                    )
                  }
                />
              </ReportCard>

              {/* Transaction History */}
              <ReportCard
                title="Batch Print Transactions"
                description="Print a filtered transaction list for a week, month, date, or employee."
              >
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={histType}
                      onValueChange={(v) => setHistType(v ?? undefined)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">IN — Stock In</SelectItem>
                        <SelectItem value="OUT">OUT — Stock Out</SelectItem>
                      </SelectContent>
                    </Select>
                    {histType && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => setHistType(undefined)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Item (optional)</Label>
                  <ItemCombobox
                    value={histItem?.id}
                    selectedLabel={
                      histItem ? `${histItem.code} — ${histItem.name}` : undefined
                    }
                    onSelect={setHistItem}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employee (optional)</Label>
                  <Input
                    value={histEmployee}
                    onChange={(event) => setHistEmployee(event.target.value)}
                    placeholder="Search employee / recipient"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit (optional)</Label>
                  <Select
                    value={histUnit || undefined}
                    onValueChange={(value) => setHistUnit(value ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All units" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {dateFilter.preset && (
                  <p className="text-xs text-muted-foreground">
                    Using date range: {dateFilter.start} → {dateFilter.end}
                  </p>
                )}
                <ReportActions
                  actionKey="transaction-history"
                  activeAction={activeReportAction}
                  onPreview={() =>
                    preview(
                      () => reportsService.getTransactionHistory({
                        type: histType as TransactionType | undefined,
                        ...dateParams,
                        item_id: histItem?.id,
                        recipient_name: histEmployee.trim() || undefined,
                        recipient_unit: histUnit || undefined,
                      }),
                      "transaction-history-preview"
                    )}
                  onDownload={() =>
                    download(
                      () =>
                        reportsService.getTransactionHistory({
                          type: histType as TransactionType | undefined,
                          ...dateParams,
                          item_id: histItem?.id,
                          recipient_name: histEmployee.trim() || undefined,
                          recipient_unit: histUnit || undefined,
                        }),
                      `transaction-history-${Date.now()}.pdf`,
                      "transaction-history-download"
                    )
                  }
                />
              </ReportCard>

            </div>

            {/* Shared preview */}
            <div ref={previewRef}>
              <PDFPreview url={previewUrl} loading={previewLoading} />
            </div>
          </TabsContent>

          {/* ── Documents tab ────────────────────────────────────────────── */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4" />
                      Stored Transaction Documents
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Every stock-in and stock-out automatically saves its slip here.
                    </CardDescription>
                  </div>
                  {selected.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeletingBulk(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete selected ({selected.size})
                    </Button>
                  )}
                </div>

                {/* Search */}
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by filename…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="pt-4">
                {storedLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filteredStored.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                    <Inbox className="h-8 w-8" />
                    <p className="text-sm">
                      {search ? "No documents match your search" : "No stored documents yet"}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Select-all */}
                    <div className="mb-2 flex items-center gap-3 pb-2 border-b">
                      <Checkbox
                        checked={
                          filteredStored.length > 0 &&
                          selected.size === filteredStored.length
                        }
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                      <span className="text-xs text-muted-foreground">
                        {selected.size === 0
                          ? `${filteredStored.length} document${filteredStored.length === 1 ? "" : "s"}`
                          : `${selected.size} of ${filteredStored.length} selected`}
                      </span>
                    </div>
                    <ul className="divide-y">
                      {filteredStored.map((f) => (
                        <li key={f.name} className="flex items-center gap-3 py-2.5">
                          <Checkbox
                            checked={selected.has(f.name)}
                            onCheckedChange={() => toggleSelect(f.name)}
                            aria-label={`Select ${f.name}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-sm">{f.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(f.modified), "MMM d, yyyy HH:mm")} ·{" "}
                              {(f.size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Preview"
                              onClick={() =>
                                preview(() => reportsService.getStoredReport(f.name), `stored-preview:${f.name}`)
                              }
                              disabled={activeReportAction !== null}
                            >
                              {activeReportAction === `stored-preview:${f.name}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Download"
                              onClick={() =>
                                download(
                                  () => reportsService.getStoredReport(f.name),
                                  f.name,
                                  `stored-download:${f.name}`
                                )
                              }
                              disabled={activeReportAction !== null}
                            >
                              {activeReportAction === `stored-download:${f.name}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              aria-label="Delete"
                              onClick={() => setDeleteTarget(f.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>

            {/* PDF preview inline in documents tab too */}
            <div ref={previewRef} className="mt-6">
              <PDFPreview url={previewUrl} loading={previewLoading} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Confirmations */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title="Delete document?"
          description={
            deleteTarget
              ? `"${deleteTarget}" will be permanently removed. This cannot be undone.`
              : undefined
          }
          confirmLabel="Delete"
          destructive
          onConfirm={handleDeleteOne}
        />
        <ConfirmDialog
          open={deletingBulk}
          onOpenChange={(o) => !o && setDeletingBulk(false)}
          title={`Delete ${selected.size} document${selected.size === 1 ? "" : "s"}?`}
          description="The selected documents will be permanently removed. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={handleDeleteSelected}
        />
      </PageWrapper>
    </AppLayout>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────
function ReportCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function ReportActions({
  disabled,
  actionKey,
  activeAction,
  onPreview,
  onDownload,
}: {
  disabled?: boolean;
  actionKey: string;
  activeAction: string | null;
  onPreview: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <Button disabled={disabled || activeAction !== null} onClick={onPreview}>
        {activeAction === `${actionKey}-preview` ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Eye className="mr-2 h-4 w-4" />
        )}
        {activeAction === `${actionKey}-preview` ? "Generating…" : "Preview"}
      </Button>
      <Button variant="outline" disabled={disabled || activeAction !== null} onClick={onDownload}>
        {activeAction === `${actionKey}-download` ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {activeAction === `${actionKey}-download` ? "Preparing…" : "Download"}
      </Button>
    </div>
  );
}
