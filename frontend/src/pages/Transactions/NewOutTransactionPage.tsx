import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AxiosError } from "axios";
import { FileText, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { AppLayout, PageWrapper } from "@/components/layout";
import { EmployeeCombobox, ItemCombobox, PdfDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { itemsService } from "@/lib/services/items.service";
import { reportsService } from "@/lib/services/reports.service";
import { transactionsService } from "@/lib/services/transactions.service";
import type { Item } from "@/types/item.types";
import type { StockOutBatch } from "@/types/transaction.types";

const MAX_ITEMS = 10;

const itemLineSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  quantity: z
    .number({ message: "Quantity is required" })
    .int("Whole numbers only")
    .min(1, "Must be at least 1"),
});

const schema = z.object({
  items: z
    .array(itemLineSchema)
    .min(1, "Add at least one item")
    .max(MAX_ITEMS, `Maximum ${MAX_ITEMS} items per transaction`),
  recipient_name: z.string().min(1, "Recipient name is required"),
  recipient_department: z.string().optional(),
  transaction_date: z.string().min(1, "Date is required"),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const today = () => new Date().toISOString().slice(0, 10);

const emptyLine = () => ({
  item_id: "",
  quantity: undefined as unknown as number,
});

export default function NewOutTransactionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetItemId = params.get("item_id") ?? "";

  // Full item records keyed by field id, for per-row stock display/validation.
  const [selectedItems, setSelectedItems] = useState<Record<string, Item | null>>(
    {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [createdBatch, setCreatedBatch] = useState<StockOutBatch | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [printingPdf, setPrintingPdf] = useState(false);
  const [presetItemLoading, setPresetItemLoading] = useState(!!presetItemId);
  const [recipientId, setRecipientId] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");
  const submitLock = useRef(false);
  const printLock = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      items: [{ ...emptyLine(), item_id: presetItemId }],
      recipient_name: "",
      recipient_department: "",
      transaction_date: today(),
      remarks: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const firstFieldId = fields[0]?.id;

  useEffect(() => {
    if (!presetItemId || !firstFieldId) {
      if (!presetItemId) setPresetItemLoading(false);
      return;
    }
    let active = true;
    itemsService
      .getItem(presetItemId)
      .then((item) => {
        if (active) {
          setSelectedItems((prev) => ({ ...prev, [firstFieldId]: item }));
        }
      })
      .catch(() => undefined)
      .finally(() => active && setPresetItemLoading(false));
    return () => {
      active = false;
    };
  }, [presetItemId, firstFieldId]);

  const watchedItems = form.watch("items");
  const maxReached = fields.length >= MAX_ITEMS;

  // Item ids selected more than once — flagged inline per row.
  const duplicateIds = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const line of watchedItems ?? []) {
      if (!line?.item_id) continue;
      if (seen.has(line.item_id)) dupes.add(line.item_id);
      seen.add(line.item_id);
    }
    return dupes;
  }, [watchedItems]);

  const exceedsAt = (index: number): number | null => {
    const fieldId = fields[index]?.id;
    const item = fieldId ? (selectedItems[fieldId] ?? null) : null;
    const qty = watchedItems?.[index]?.quantity;
    if (!item || typeof qty !== "number") return null;
    return qty > (item.quantity ?? 0) ? (item.quantity ?? 0) : null;
  };

  const anyExceeds = fields.some((_, i) => exceedsAt(i) !== null);
  const hasDuplicates = duplicateIds.size > 0;

  const handleRemove = (index: number) => {
    const id = fields[index]?.id;
    remove(index);
    if (id) {
      setSelectedItems((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  async function onSubmit(values: FormValues) {
    if (submitLock.current || presetItemLoading) return;
    // Final per-row stock guard (the submit button is already disabled,
    // this covers programmatic submits).
    for (let i = 0; i < values.items.length; i++) {
      const available = exceedsAt(i);
      if (available !== null) {
        form.setError(`items.${i}.quantity`, {
          message: `Only ${available} in stock`,
        });
        return;
      }
    }
    if (hasDuplicates) {
      toast.error("Remove duplicate items before recording");
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const batch = await transactionsService.createOutBatch({
        items: values.items.map((line) => ({
          item_id: line.item_id,
          quantity: line.quantity,
        })),
        recipient_name: values.recipient_name,
        recipient_department: values.recipient_department || undefined,
        transaction_date: new Date(values.transaction_date).toISOString(),
        remarks: values.remarks || undefined,
      });
      setCreatedBatch(batch);
      toast.success(
        `Stock-out recorded — ${batch.reference_number} · ${batch.item_count} item${batch.item_count === 1 ? "" : "s"}`
      );
    } catch (err) {
      const detail =
        err instanceof AxiosError
          ? (err.response?.data?.detail as string | undefined)
          : undefined;
      toast.error(detail ?? "Failed to record stock-out");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  async function printPdf() {
    if (!createdBatch || printLock.current) return;
    printLock.current = true;
    setPrintingPdf(true);
    try {
      const url = await reportsService.getBatchSlip(
        createdBatch.reference_number
      );
      setPdfUrl(url);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      printLock.current = false;
      setPrintingPdf(false);
    }
  }

  if (createdBatch) {
    return (
      <AppLayout>
        <PageWrapper title="Stock-Out Recorded">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {createdBatch.item_count} item
                {createdBatch.item_count === 1 ? "" : "s"} released under{" "}
                <span className="font-semibold text-foreground">
                  {createdBatch.reference_number}
                </span>
                .
              </p>
              <div className="flex gap-2">
                <Button onClick={printPdf} disabled={printingPdf}>
                  {printingPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  {printingPdf ? "Generating PDF…" : "Print PDF"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/transactions")}
                >
                  Back to Transactions
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageWrapper>
        <PdfDialog
          url={pdfUrl}
          onOpenChange={(o) => !o && setPdfUrl(null)}
          title="Issuance Slip"
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageWrapper
        title="Record Stock-Out"
        subtitle="Release supplies from inventory"
      >
        <Card className="max-w-2xl">
          <CardContent className="pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <div>
                  <div className="flex items-baseline justify-between">
                    <FormLabel>Items</FormLabel>
                    <span className="text-xs text-muted-foreground">
                      {fields.length} of {MAX_ITEMS}
                    </span>
                  </div>

                  <div className="mt-2 space-y-3">
                    {fields.map((field, index) => {
                      const item = selectedItems[field.id] ?? null;
                      const available = item?.quantity ?? 0;
                      const exceeds = exceedsAt(index);
                      const lineItemId = watchedItems?.[index]?.item_id;
                      const isDuplicate =
                        !!lineItemId && duplicateIds.has(lineItemId);
                      return (
                        <div
                          key={field.id}
                          className="rounded-xl border bg-card p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Item {index + 1}
                            </span>
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemove(index)}
                                disabled={submitting}
                                aria-label={`Remove item ${index + 1}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.item_id`}
                              render={({ field: itemField }) => (
                                <FormItem className="flex min-w-0 flex-col">
                                  <FormControl>
                                    <ItemCombobox
                                      value={itemField.value}
                                      disabled={submitting || presetItemLoading}
                                      selectedLabel={
                                        item
                                          ? `${item.code} — ${item.name}`
                                          : undefined
                                      }
                                      onSelect={(selected) => {
                                        itemField.onChange(selected.id);
                                        setSelectedItems((prev) => ({
                                          ...prev,
                                          [field.id]: selected,
                                        }));
                                        form.trigger(`items.${index}.quantity`);
                                      }}
                                    />
                                  </FormControl>
                                  {isDuplicate ? (
                                    <p className="text-sm font-medium text-destructive">
                                      This item is already in the list
                                    </p>
                                  ) : (
                                    <FormMessage />
                                  )}
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field: qtyField }) => (
                                <FormItem className="min-w-0">
                                  <FormControl>
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="Qty"
                                      aria-label={`Quantity for item ${index + 1}`}
                                      value={qtyField.value ?? ""}
                                      onChange={(e) => {
                                        const digits = e.target.value.replace(
                                          /[^0-9]/g,
                                          ""
                                        );
                                        qtyField.onChange(
                                          digits === ""
                                            ? undefined
                                            : Number(digits)
                                        );
                                      }}
                                      onBlur={qtyField.onBlur}
                                      name={qtyField.name}
                                      ref={qtyField.ref}
                                    />
                                  </FormControl>
                                  {exceeds !== null ? (
                                    <p className="text-sm font-medium text-destructive">
                                      Only {exceeds} in stock
                                    </p>
                                  ) : (
                                    <FormMessage />
                                  )}
                                </FormItem>
                              )}
                            />
                          </div>

                          {presetItemLoading && index === 0 && presetItemId && (
                            <FormDescription
                              className="mt-2 inline-flex items-center gap-2"
                              role="status"
                              aria-live="polite"
                            >
                              <Loader2
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden="true"
                              />
                              Loading selected item…
                            </FormDescription>
                          )}
                          {item && (
                            <FormDescription className="mt-2">
                              Available: {available} {item.unit ?? ""}
                            </FormDescription>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full border-dashed"
                    disabled={submitting || maxReached}
                    onClick={() => append(emptyLine())}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add item
                  </Button>
                  {maxReached ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Maximum of {MAX_ITEMS} items per transaction reached — you
                      cannot add more items to this transaction.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      You can add up to {MAX_ITEMS} items per transaction.
                    </p>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="transaction_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="recipient_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient</FormLabel>
                        <FormControl>
                          <EmployeeCombobox
                            value={recipientId}
                            selectedLabel={recipientName}
                            disabled={submitting}
                            onSelect={(employee) => {
                              setRecipientId(employee.id);
                              setRecipientName(employee.full_name);
                              field.onChange(employee.full_name);
                              form.setValue(
                                "recipient_department",
                                employee.unit ?? ""
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="recipient_department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Unit / Department{" "}
                          <span className="text-muted-foreground">
                            (optional)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Choose an employee to fill their unit"
                            readOnly
                            className="bg-muted"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Automatically copied from the selected employee.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormItem>
                  <FormLabel>Reference No.</FormLabel>
                  <FormControl>
                    <Input
                      readOnly
                      value="Auto-generated (REL-YYYY-XXXX)"
                      className="bg-muted text-muted-foreground"
                    />
                  </FormControl>
                </FormItem>

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Remarks{" "}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/transactions")}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      anyExceeds ||
                      hasDuplicates ||
                      presetItemLoading
                    }
                  >
                    {submitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Record Stock-Out
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </PageWrapper>
    </AppLayout>
  );
}
