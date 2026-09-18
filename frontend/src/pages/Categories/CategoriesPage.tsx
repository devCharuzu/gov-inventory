import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ban, Inbox, Loader2, Pencil, Plus, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { AppLayout, PageWrapper } from "@/components/layout";
import { ConfirmDialog, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { categoriesService } from "@/lib/services/categories.service";
import { useAuth } from "@/store/AuthContext";
import type { Category } from "@/types/category.types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function CategoriesPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "encoder";
  const isAdmin = user?.role === "admin";

  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<Category | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  });

  const fetchRows = useCallback(() => {
    setLoading(true);
    categoriesService
      .getCategories()
      .then(setRows)
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(fetchRows, [fetchRows]);

  function openAdd() {
    setEditing(null);
    form.reset({ name: "", description: "" });
    setDialogOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    form.reset({ name: c.name, description: c.description ?? "" });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const payload = {
      name: values.name,
      description: values.description || undefined,
    };
    try {
      if (editing) {
        await categoriesService.updateCategory(editing.id, payload);
        toast.success("Category updated");
      } else {
        await categoriesService.createCategory(payload);
        toast.success("Category created");
      }
      setDialogOpen(false);
      fetchRows();
    } catch {
      toast.error("Failed to save category");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!toDeactivate) return;
    try {
      await categoriesService.deleteCategory(toDeactivate.id);
      toast.success(`Deactivated ${toDeactivate.name}`);
      fetchRows();
    } catch {
      toast.error("Failed to deactivate category");
    }
  }

  async function handleReactivate(c: Category) {
    try {
      await categoriesService.updateCategory(c.id, { is_active: true });
      toast.success(`Reactivated ${c.name}`);
      fetchRows();
    } catch {
      toast.error("Failed to reactivate category");
    }
  }

  return (
    <AppLayout>
      <PageWrapper
        title="Categories"
        subtitle="Manage item categories"
        actions={
          canManage && (
            <Button onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          )
        }
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Inbox className="h-8 w-8" />
                      <p className="text-sm">No categories yet</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id} className={c.is_active ? "" : "opacity-50"}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {c.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge active={c.is_active} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(c.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(c)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin &&
                          (c.is_active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setToDeactivate(c)}
                              aria-label="Deactivate"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600"
                              onClick={() => handleReactivate(c)}
                              aria-label="Reactivate"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageWrapper>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Category" : "Add Category"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input disabled={submitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} disabled={submitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editing ? "Save Changes" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDeactivate}
        onOpenChange={(o) => !o && setToDeactivate(null)}
        title="Deactivate category?"
        description={
          toDeactivate
            ? `${toDeactivate.name} will be marked inactive.`
            : undefined
        }
        confirmLabel="Deactivate"
        destructive
        onConfirm={handleDeactivate}
      />
    </AppLayout>
  );
}
