import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
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
import {
  transactionsService,
  type TransactionFilters,
} from "@/lib/services/transactions.service";
import { useAuth } from "@/store/AuthContext";
import type { Transaction, TransactionType } from "@/types/transaction.types";

const PAGE_SIZE = 15;

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

  const [type, setType] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [datePreset, setDatePreset] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const iso = (d: Date) => format(d, "yyyy-MM-dd");

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
    } else if (preset === "specific") {
      const date = iso(now);
      setStartDate(date);
      setEndDate(date);
    } else if (!preset) {
      setStartDate("");
      setEndDate("");
    }
  }

  const [viewing, setViewing] = useState<Transaction | null>(null);
  const [toVoid, setToVoid] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

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
    }),
    [page, type, startDate, endDate, employeeSearch]
  );

  const fetchRows = useCallback(() => {
    setLoading(true);
    transactionsService
      .getTransactions(buildFilters())
      .then((res) => {
        // Item search remains client-side; employee search is server-side so
        // it works across every page of the transaction history.
        const filtered = search
          ? res.items.filter((t) =>
              t.item?.name?.toLowerCase().includes(search.toLowerCase()) ||
              t.item?.code?.toLowerCase().includes(search.toLowerCase())
            )
          : res.items;
        setRows(filtered);
        setTotal(res.total);
      })
      .catch(() => toast.error("Failed to load transactions"))
      .finally(() => setLoading(false));
  }, [buildFilters, search]);

  useEffect(() => {
    const t = setTimeout(fetchRows, 250);
    return () => clearTimeout(t);
  }, [fetchRows]);

  useEffect(() => {
    setPage(1);
  }, [type, startDate, endDate, employeeSearch]);

  async function handleVoid() {
    if (!toVoid) return;
    try {
      await transactionsService.voidTransaction(toVoid.id);
      toast.success(`Voided ${toVoid.reference_number}`);
      fetchRows();
    } catch {
      toast.error("Failed to void transaction");
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await transactionsService.hardDeleteTransaction(toDelete.id);
      toast.success(`Deleted ${toDelete.reference_number}`);
      setSelected((s) => { s.delete(toDelete.id); return new Set(s); });
      fetchRows();
    } catch {
      toast.error("Failed to delete transaction");
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      const res = await transactionsService.bulkDeleteTransactions(ids);
      toast.success(`Deleted ${res.deleted} transaction${res.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      fetchRows();
    } catch {
      toast.error("Failed to delete transactions");
    }
  }

  async function handleDeleteAll() {
    const ids = rows.map((r) => r.id);
    if (!ids.length) return;
    try {
      const res = await transactionsService.bulkDeleteTransactions(ids);
      toast.success(`Deleted ${res.deleted} transaction${res.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      fetchRows();
    } catch {
      toast.error("Failed to delete transactions");
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  }

  function toggleSelectAll() {
    if (selected.size === rows.length && rows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  async function exportPdf() {
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
      });
      setPdfUrl(url);
    } catch {
      toast.error("Failed to export PDF");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppLayout>
      <PageWrapper
        title="Transactions"
        subtitle="Stock-in and stock-out records"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPdf}>
              <Printer className="mr-2 h-4 w-4" />
              Batch Print
            </Button>
            {isAdmin && selected.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selected.size})
              </Button>
            )}
            {isAdmin && selected.size > 0 && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDeleteAll(true)}
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
          <Select value={type} onValueChange={(v) => setType(v ?? undefined)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IN">IN</SelectItem>
              <SelectItem value="OUT">OUT</SelectItem>
            </SelectContent>
          </Select>
          {type && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setType(undefined)} aria-label="Clear">
              <X className="h-4 w-4" />
            </Button>
          )}
          <Select value={datePreset} onValueChange={applyPreset}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="specific">Specific date</SelectItem>
            </SelectContent>
          </Select>
          {datePreset && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => applyPreset(null)} aria-label="Clear">
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
            />
          )}
          <Input
            placeholder="Search item or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Input
            placeholder="Search employee…"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            className="max-w-xs"
          />
          <p className="basis-full text-xs text-muted-foreground">
            Batch Print uses the selected type, date range, and employee filter.
          </p>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={rows.length > 0 && selected.size === rows.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
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
                    {Array.from({ length: isAdmin ? 9 : 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="h-40">
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
                    {isAdmin && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(t.id)}
                          onCheckedChange={() => toggleSelect(t.id)}
                          aria-label="Select row"
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">
                      <span className={t.voided ? "text-muted-foreground line-through" : ""}>
                        {t.reference_number}
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
                    <TableCell className="max-w-[160px] truncate text-sm">
                      {t.transaction_type === "OUT"
                        ? t.recipient_name ?? "—"
                        : "—"}
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
              Transaction {viewing?.reference_number}
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
            ? `${toVoid.reference_number} will be voided and its stock effect reversed. This cannot be undone.`
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
            ? `${toDelete.reference_number} will be permanently deleted and its stock effect reversed if not already voided. This cannot be undone.`
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
