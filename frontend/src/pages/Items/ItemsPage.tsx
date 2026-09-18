import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { AppLayout, PageWrapper } from "@/components/layout";
import { ConfirmDialog, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { categoriesService } from "@/lib/services/categories.service";
import { itemsService, type ItemFilters } from "@/lib/services/items.service";
import { useAuth } from "@/store/AuthContext";
import type { Category } from "@/types/category.types";
import type { Item } from "@/types/item.types";

const PAGE_SIZE = 10;

export default function ItemsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "encoder";
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters (undefined = no filter; the dropdown shows its placeholder)
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [activeOnly, setActiveOnly] = useState<string | undefined>(undefined);
  const [lowStock, setLowStock] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [toDeactivate, setToDeactivate] = useState<Item | null>(null);
  const [toDelete, setToDelete] = useState<Item | null>(null);

  useEffect(() => {
    categoriesService
      .getCategories(true)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const filters: ItemFilters = {
      page,
      size: PAGE_SIZE,
      search: search || undefined,
      category_id: categoryId,
      is_active: activeOnly === undefined ? undefined : activeOnly === "active",
      low_stock: lowStock || undefined,
    };
    itemsService
      .getItems(filters)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => toast.error("Failed to load items"))
      .finally(() => setLoading(false));
  }, [page, search, categoryId, activeOnly, lowStock]);

  // Debounce search; immediate for other filters.
  useEffect(() => {
    const t = setTimeout(fetchItems, 300);
    return () => clearTimeout(t);
  }, [fetchItems]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [search, categoryId, activeOnly, lowStock]);

  async function handleDeactivate() {
    if (!toDeactivate) return;
    try {
      await itemsService.deleteItem(toDeactivate.id);
      toast.success(`Deactivated ${toDeactivate.code}`);
      fetchItems();
    } catch {
      toast.error("Failed to deactivate item");
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await itemsService.hardDeleteItem(toDelete.id);
      toast.success(`Deleted ${toDelete.code}`);
      fetchItems();
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
      toast.error(detail ?? "Failed to delete item");
    }
  }

  const handleReactivate = useCallback(
    async (item: Item) => {
      try {
        await itemsService.updateItem(item.id, { is_active: true });
        toast.success(`Reactivated ${item.code}`);
        fetchItems();
      } catch {
        toast.error("Failed to reactivate item");
      }
    },
    [fetchItems]
  );

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      { accessorKey: "code", header: "Code" },
      { accessorKey: "name", header: "Name" },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => row.original.category?.name ?? "—",
      },
      {
        accessorKey: "unit",
        header: "Unit",
        cell: ({ row }) => row.original.unit ?? "—",
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ row }) => {
          const it = row.original;
          const low = it.quantity <= it.minimum_quantity;
          return (
            <span className={cn(low && "font-semibold text-amber-600")}>
              {it.quantity}
            </span>
          );
        },
      },
      { accessorKey: "minimum_quantity", header: "Min Qty" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge active={row.original.is_active} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const it = row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigate(`/items/${it.id}`)}
                aria-label="View"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate(`/items/${it.id}/edit`)}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {isAdmin &&
                (it.is_active ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-amber-600 hover:text-amber-600"
                    onClick={() => setToDeactivate(it)}
                    aria-label="Deactivate"
                    title="Deactivate (keeps history)"
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-600"
                    onClick={() => handleReactivate(it)}
                    aria-label="Reactivate"
                    title="Reactivate"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                ))}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setToDelete(it)}
                  aria-label="Delete"
                  title="Delete permanently"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [navigate, isAdmin, handleReactivate]
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppLayout>
      <PageWrapper
        title="Items"
        subtitle="Manage inventory items and stock levels"
        actions={
          canManage && (
            <Button onClick={() => navigate("/items/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          )
        }
      >
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex items-center gap-1">
            <Select
              value={categoryId}
              onValueChange={(v) => setCategoryId(v ?? undefined)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All categories">
                  {(val) => categories.find((c) => c.id === val)?.name ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoryId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCategoryId(undefined)}
                aria-label="Clear category filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={activeOnly}
              onValueChange={(v) => setActiveOnly(v ?? undefined)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {activeOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setActiveOnly(undefined)}
                aria-label="Clear status filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={lowStock}
              onCheckedChange={(v) => setLowStock(v === true)}
            />
            Low stock only
          </label>

          {/* Status legend */}
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-600" />
              Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
              Inactive
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {h.isPlaceholder
                        ? null
                        : flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_c, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-40">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Inbox className="h-8 w-8" />
                      <p className="text-sm">No items found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      !row.original.is_active && "bg-muted/40 text-muted-foreground"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} item{total === 1 ? "" : "s"} · Page {page} of {totalPages}
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

      <ConfirmDialog
        open={!!toDeactivate}
        onOpenChange={(o) => !o && setToDeactivate(null)}
        title="Deactivate item?"
        description={
          toDeactivate
            ? `${toDeactivate.code} — ${toDeactivate.name} will be marked inactive but kept in the system. This can be reversed by an admin.`
            : undefined
        }
        confirmLabel="Deactivate"
        destructive
        onConfirm={handleDeactivate}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete item permanently?"
        description={
          toDelete
            ? `${toDelete.code} — ${toDelete.name} will be permanently removed. Items with transaction history cannot be deleted — deactivate them instead.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </AppLayout>
  );
}
