import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  Loader2,
  Plus,
  Printer,
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
import { ConfirmDialog, DateInput, PdfDialog } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reportsService } from "@/lib/services/reports.service";
import { EMPLOYEE_UNITS } from "@/lib/employee-units";
import {
  transactionsService,
  type TransactionFilters,
} from "@/lib/services/transactions.service";
import { useAuth } from "@/store/AuthContext";
import type { Transaction, TransactionType } from "@/types/transaction.types";

const PAGE_SIZE = 15;
const DATE_PRESET_LABELS: Record<string, string> = {
  week: "This week",
  month: "This month",
  year: "This year",
  specific: "Specific date",
  range: "Date range",
};

function TypeBadge({ type }: { type: TransactionType }) {
  return (
    <Badge
      className={
        type === "IN"
          ? "bg-green-600 hover:bg-green-600"
          : "bg-red-600 hover:bg-red-600"
      }
    >
      {type}
    </Badge>
  );
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManage = isAdmin || user?.role === "encoder";

  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const [type, setType] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [datePreset, setDatePreset] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("");

  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  const invalidDateRange = datePreset === "range" && !!startDate && !!endDate && endDate < startDate;

  function applyPreset(value: string | null) {
    const preset = value ?? undefined;
    setDatePreset(preset);
    const now = new Date();
    if (preset === "week") {
      setStartDate(iso(startOfWeek(now, { weekStartsOn: 1 })));
      setEndDate(iso(endOfWeek(now, { weekStartsOn: 1 })));
    } else if (preset === "month") {
      setStartDate(iso(startOfMonth(now)));
      setEndDate(iso(endOfMonth(now)));
    } else if (preset === "year") {
      setStartDate(iso(startOfYear(now)));
      setEndDate(iso(endOfYear(now)));
    } else if (preset === "specific") {
      const date = iso(now);
      setStartDate(date);
      setEndDate(date);
    } else if (preset === "range") {
      // Preserve existing dates so a preset can be refined as a custom range.
    } else if (!preset) {
      setStartDate("");
      setEndDate("");
    }
  }

  const [viewing, setViewing] = useState<Transaction | null>(null);
  const [toVoid, setToVoid] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, Transaction>>(new Map());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const selectingAllRef = useRef(false);
  const [exportAction, setExportAction] = useState<"history" | "slips" | null>(null);
  const exportActionRef = useRef(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const deletingSelectedRef = useRef(false);

  const buildFilters = useCallback(
    (): TransactionFilters => ({
      page,
      size: PAGE_SIZE,
      type: type as TransactionType | undefined,
      start_date: startDate
        ? new Date(`${startDate}T00:00:00`).toISOString()
        : undefined,
      end_date: endDate
        ? new Date(`${endDate}T23:59:59.999`).toISOString()
        : undefined,
      recipient_name: employeeSearch.trim() || undefined,
      recipient_unit: unitFilter || undefined,
      item_search: search.trim() || undefined,
    }),
    [page, type, startDate, endDate, employeeSearch, unitFilter, search]
  );

  const fetchRows = useCallback(() => {
    const activeRequest = ++requestId.current;
    if (invalidDateRange) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    transactionsService
      .getTransactions(buildFilters())
      .then((res) => {
        if (activeRequest !== requestId.current) return;
        setRows(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        if (activeRequest === requestId.current) toast.error("Failed to load transactions");
      })
      .finally(() => {
        if (activeRequest === requestId.current) setLoading(false);
      });
  }, [buildFilters, invalidDateRange]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(fetchRows, 250);
    return () => {
      clearTimeout(t);
      requestId.current += 1;
    };
  }, [fetchRows]);

  useEffect(() => {
    setPage(1);
    setSelected(new Map());
  }, [type, startDate, endDate, employeeSearch, unitFilter, search]);

  async function handleVoid() {
    if (!toVoid) return;
    try {
      await transactionsService.voidTransaction(toVoid.id);
      toast.success(`Voided ${toVoid.reference_number ?? "transaction"}`);
      fetchRows();
    } catch {
      toast.error("Failed to void transaction");
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await transactionsService.hardDeleteTransaction(toDelete.id);
      toast.success(`Deleted ${toDelete.reference_number ?? "transaction"}`);
      setSelected((previous) => {
        const next = new Map(previous);
        next.delete(toDelete.id);
        return next;
      });
      fetchRows();
    } catch {
      toast.error("Failed to delete transaction");
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selected.keys()];
    if (!ids.length || deletingSelectedRef.current) return;
    deletingSelectedRef.current = true;
    setDeletingSelected(true);
    try {
      const res = await transactionsService.bulkDeleteTransactions(ids);
      toast.success(`Deleted ${res.deleted} transaction${res.deleted === 1 ? "" : "s"}`);
      setSelected(new Map());
      fetchRows();
    } catch {
      toast.error("Failed to delete transactions");
    } finally {
      deletingSelectedRef.current = false;
      setDeletingSelected(false);
    }
  }

  async function handleDeleteAll() {
    const ids = rows.map((r) => r.id);
    if (!ids.length) return;
    try {
      const res = await transactionsService.bulkDeleteTransactions(ids);
      toast.success(`Deleted ${res.deleted} transaction${res.deleted === 1 ? "" : "s"}`);
      setSelected(new Map());
      fetchRows();
    } catch {
      toast.error("Failed to delete transactions");
    }
  }

  function toggleSelect(transaction: Transaction) {
    if (!selected.has(transaction.id) && selected.size >= 250) {
      toast.error("Select at most 250 transactions per batch");
      return;
    }
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(transaction.id)) {
        next.delete(transaction.id);
      } else {
        next.set(transaction.id, transaction);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    const allVisibleSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
    const newSelections = rows.filter((row) => !selected.has(row.id)).length;
    if (!allVisibleSelected && selected.size + newSelections > 250) {
      toast.error("Select at most 250 transactions per batch");
      return;
    }
    setSelected((previous) => {
      const next = new Map(previous);
      rows.forEach((row) => {
        if (allVisibleSelected) next.delete(row.id);
        else next.set(row.id, row);
      });
      return next;
    });
  }

  async function toggleSelectAllMatching() {
    if (selectingAllRef.current || loading) return;
    if (selected.size === total) {
      setSelected(new Map());
      return;
    }

    selectingAllRef.current = true;
    setSelectingAll(true);
    try {
      const filters = { ...buildFilters(), page: 1, size: 100 };
      const firstPage = await transactionsService.getTransactions(filters);
      if (firstPage.total > 250) {
        toast.error("More than 250 records match. Narrow by date, unit, or employee first.");
        return;
      }

      const remainingPages = await Promise.all(
        Array.from(
          { length: Math.max(0, Math.ceil(firstPage.total / 100) - 1) },
          (_, index) =>
            transactionsService.getTransactions({ ...filters, page: index + 2 })
        )
      );
      const matchingRows = [
        ...firstPage.items,
        ...remainingPages.flatMap((response) => response.items),
      ];
      setSelected(new Map(matchingRows.map((transaction) => [transaction.id, transaction])));
      toast.success(`${matchingRows.length} matching transaction${matchingRows.length === 1 ? "" : "s"} selected`);
    } catch {
      toast.error("Could not select all matching transactions");
    } finally {
      selectingAllRef.current = false;
      setSelectingAll(false);
    }
  }

  async function exportPdf() {
    if (exportActionRef.current) return;
    exportActionRef.current = true;
    setExportAction("history");
    try {
      const url = await reportsService.getTransactionHistory({
        type: type as TransactionType | undefined,
        start_date: startDate
          ? new Date(`${startDate}T00:00:00`).toISOString()
          : undefined,
        end_date: endDate
          ? new Date(`${endDate}T23:59:59.999`).toISOString()
          : undefined,
        recipient_name: employeeSearch.trim() || undefined,
        recipient_unit: unitFilter || undefined,
        item_search: search.trim() || undefined,
        transaction_ids: selected.size ? [...selected.keys()].join(",") : undefined,
      });
      setPdfUrl(url);
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      exportActionRef.current = false;
      setExportAction(null);
    }
  }

  async function exportRequestSlips() {
    if (exportActionRef.current) return;
    const selectedOut = [...selected.values()].filter(
      (transaction) => transaction.transaction_type === "OUT" && !transaction.voided
    );
    if (selected.size > 0 && selectedOut.length === 0) {
      toast.info("Select at least one active OUT transaction to print request slips");
      return;
    }
    exportActionRef.current = true;
    setExportAction("slips");
    try {
      const url = await reportsService.getRequestForms(
        selectedOut.length
          ? { transaction_ids: selectedOut.map((transaction) => transaction.id).join(",") }
          : {
              start_date: startDate
                ? new Date(`${startDate}T00:00:00`).toISOString()
                : undefined,
              end_date: endDate
                ? new Date(`${endDate}T23:59:59.999`).toISOString()
                : undefined,
              recipient_name: employeeSearch.trim() || undefined,
              recipient_unit: unitFilter || undefined,
              item_search: search.trim() || undefined,
            }
      );
      setPdfUrl(url);
    } catch {
      toast.error("No matching stock-out request slips could be generated");
    } finally {
      exportActionRef.current = false;
      setExportAction(null);
    }
  }

  const selectedOutCount = [...selected.values()].filter(
    (transaction) => transaction.transaction_type === "OUT" && !transaction.voided
  ).length;
  const allMatchingSelected = total > 0 && selected.size === total;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppLayout>
      <PageWrapper
        title="Transactions"
        subtitle="Stock-in and stock-out records"
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={exportPdf} disabled={exportAction !== null || invalidDateRange}>
              {exportAction === "history" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              {exportAction === "history"
                ? "Generating PDF…"
                : selected.size
                  ? `History PDF (${selected.size})`
                  : "Batch Print History"}
            </Button>
            {(type === "OUT" || selectedOutCount > 0) && (
              <Button variant="outline" onClick={exportRequestSlips} disabled={exportAction !== null || invalidDateRange}>
                {exportAction === "slips" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                {exportAction === "slips"
                  ? "Generating slips…"
                  : selectedOutCount
                    ? `OUT Request Slips (${selectedOutCount})`
                    : "Batch OUT Request Slips"}
              </Button>
            )}
            {isAdmin && selected.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={deletingSelected || exportAction !== null || selectingAll}
              >
                {deletingSelected ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {deletingSelected ? "Deleting…" : `Delete (${selected.size})`}
              </Button>
            )}
            {isAdmin && selected.size > 0 && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDeleteAll(true)}
                disabled={deletingSelected || exportAction !== null || selectingAll}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete All
              </Button>
            )}
            {canManage && (
              <>
                <Button onClick={() => navigate("/transactions/in")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Stock In
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/transactions/out")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Stock Out
                </Button>
              </>
            )}
          </div>
        }
      >
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={type} onValueChange={(v) => setType(v ?? undefined)} disabled={selectingAll}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IN">IN</SelectItem>
              <SelectItem value="OUT">OUT</SelectItem>
            </SelectContent>
          </Select>
          {type && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setType(undefined)} aria-label="Clear" disabled={selectingAll}>
              <X className="h-4 w-4" />
            </Button>
          )}
          <Select value={datePreset} onValueChange={applyPreset} disabled={selectingAll}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All dates">
                {datePreset ? DATE_PRESET_LABELS[datePreset] : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="year">This year</SelectItem>
              <SelectItem value="specific">Specific date</SelectItem>
              <SelectItem value="range">Date range</SelectItem>
            </SelectContent>
          </Select>
          {datePreset && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => applyPreset(null)} aria-label="Clear" disabled={selectingAll}>
              <X className="h-4 w-4" />
            </Button>
          )}
          {datePreset === "specific" && (
            <DateInput
              value={startDate}
              onChange={(value) => {
                setStartDate(value);
                setEndDate(value);
              }}
              placeholder="Select date"
              aria-label="Specific date"
              disabled={selectingAll}
            />
          )}
          {datePreset === "range" && (
            <div className="flex flex-wrap items-center gap-2">
              <DateInput
                value={startDate}
                onChange={setStartDate}
                placeholder="Starting date"
                aria-label="Starting date"
                disabled={selectingAll}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <DateInput
                value={endDate}
                onChange={setEndDate}
                placeholder="Ending date"
                aria-label="Ending date"
                disabled={selectingAll}
              />
            </div>
          )}
          {invalidDateRange && (
            <p className="basis-full text-sm text-destructive" role="alert">
              Ending date must be the same as or later than the starting date.
            </p>
          )}
          <Select
            value={unitFilter || undefined}
            onValueChange={(value) => setUnitFilter(value ?? "")}
            disabled={selectingAll}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All units" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {unitFilter && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setUnitFilter("")}
              aria-label="Clear unit filter"
              disabled={selectingAll}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Input
            placeholder="Search item or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
            disabled={selectingAll}
          />
          <Input
            placeholder="Search employee…"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            className="max-w-xs"
            disabled={selectingAll}
          />
          <p className="basis-full text-xs text-muted-foreground">
            Select rows for a manual batch, or leave them unselected to print all matches. Filters include unit and date; selected batches are limited to 250 records.
          </p>
          {total > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAllMatching}
              disabled={loading || selectingAll || deletingSelected || exportAction !== null || total > 250}
            >
              {selectingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Selecting matches…
                </>
              ) : total > 250
                ? "Narrow filters to 250 or fewer"
                : allMatchingSelected
                  ? "Clear selection"
                  : `Select all ${total} matching`}
            </Button>
          )}
          {selected.size > 0 && (
            <p className="basis-full text-xs font-medium text-primary">
              {selected.size} selected across pages · table header selects the current page.
            </p>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={rows.length > 0 && rows.every((row) => selected.has(row.id))}
                    onCheckedChange={toggleSelectAll}
                    disabled={loading || selectingAll || exportAction !== null || deletingSelected}
                    aria-label="Select all transactions on this page"
                  />
                </TableHead>
                <TableHead>Ref No.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-40">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Inbox className="h-8 w-8" />
                      <p className="text-sm">No transactions found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((t) => (
                  <TableRow
                    key={t.id}
                    className={t.voided ? "bg-muted/40" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={() => toggleSelect(t)}
                        disabled={loading || selectingAll || exportAction !== null || deletingSelected}
                        aria-label={`Select ${t.reference_number ?? "transaction without reference"}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className={t.voided ? "text-muted-foreground line-through" : ""}>
                        {t.reference_number ?? "—"}
                      </span>
                      {t.voided && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-destructive/30 text-[10px] text-destructive"
                        >
                          Voided
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={t.transaction_type} />
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate">
                      {t.item?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{t.quantity}</TableCell>
                    <TableCell className="max-w-[180px] text-sm">
                      {t.transaction_type === "OUT" ? (
                        <div className="min-w-0">
                          <p className="truncate">{t.recipient_name ?? "—"}</p>
                          {t.recipient_department && (
                            <p className="truncate text-xs text-muted-foreground">
                              {t.recipient_department}
                            </p>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(t.transaction_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">
                      {t.creator?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewing(t)}
                          aria-label="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && !t.voided && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setToVoid(t)}
                            disabled={deletingSelected}
                            aria-label="Void"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setToDelete(t)}
                            disabled={deletingSelected}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} record{total === 1 ? "" : "s"} · Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </PageWrapper>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Transaction {viewing?.reference_number ?? "—"}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Detail label="Type" value={viewing.transaction_type} />
              <Detail label="Quantity" value={String(viewing.quantity)} />
              <Detail label="Item" value={viewing.item?.name ?? "—"} />
              <Detail
                label="Date"
                value={format(
                  new Date(viewing.transaction_date),
                  "MMM d, yyyy"
                )}
              />
              {viewing.transaction_type === "OUT" && (
                <>
                  <Detail
                    label="Recipient"
                    value={viewing.recipient_name ?? "—"}
                  />
                  <Detail
                    label="Department"
                    value={viewing.recipient_department ?? "—"}
                  />
                  <Detail label="Purpose" value={viewing.purpose ?? "—"} />
                </>
              )}
              <Detail label="Recorded by" value={viewing.creator?.full_name ?? "—"} />
              <div className="col-span-2">
                <dt className="text-muted-foreground">Remarks</dt>
                <dd className="mt-1">{viewing.remarks || "—"}</dd>
              </div>
              {viewing.voided && (
                <div className="col-span-2">
                  <Badge variant="destructive">Voided</Badge>
                </div>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {/* Void confirm */}
      <ConfirmDialog
        open={!!toVoid}
        onOpenChange={(o) => !o && setToVoid(null)}
        title="Void transaction?"
        description={
          toVoid
            ? `${toVoid.reference_number ?? "This transaction"} will be voided and its stock effect reversed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Void"
        destructive
        onConfirm={handleVoid}
      />

      {/* Delete single */}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete transaction?"
        description={
          toDelete
            ? `${toDelete.reference_number ?? "This transaction"} will be permanently deleted and its stock effect reversed if not already voided. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />

      {/* Delete selected / all */}
      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Delete all visible transactions?"
        description={`${rows.length} transaction${rows.length === 1 ? "" : "s"} on this page will be permanently deleted and their stock effects reversed. This cannot be undone.`}
        confirmLabel="Delete All"
        destructive
        onConfirm={handleDeleteAll}
      />

      <PdfDialog
        url={pdfUrl}
        onOpenChange={(o) => !o && setPdfUrl(null)}
        title="Transaction History Report"
      />
    </AppLayout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
