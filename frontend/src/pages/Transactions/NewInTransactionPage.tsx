import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AxiosError } from "axios";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout, PageWrapper } from "@/components/layout";
import { ItemCombobox, PdfDialog } from "@/components/shared";
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

const schema = z.object({
  item_id: z.string().min(1, "Item is required"),
  quantity: z
    .number({ message: "Quantity is required" })
    .int("Whole numbers only")
    .min(1, "Must be at least 1"),
  transaction_date: z.string().min(1, "Date is required"),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const today = () => new Date().toISOString().slice(0, 10);

export default function NewInTransactionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetItemId = params.get("item_id") ?? "";

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [printingPdf, setPrintingPdf] = useState(false);
  const [presetItemLoading, setPresetItemLoading] = useState(!!presetItemId);
  const submitLock = useRef(false);
  const printLock = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      item_id: presetItemId,
      quantity: undefined as unknown as number,
      transaction_date: today(),
      remarks: "",
    },
  });

  // Hydrate preset item (from "Record IN" deep link).
  useEffect(() => {
    if (presetItemId) {
      let active = true;
      itemsService
        .getItem(presetItemId)
        .then((item) => active && setSelectedItem(item))
        .catch(() => undefined)
        .finally(() => active && setPresetItemLoading(false));
      return () => {
        active = false;
      };
    }
  }, [presetItemId]);

  async function onSubmit(values: FormValues) {
    if (submitLock.current || presetItemLoading) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const txn = await transactionsService.createIn({
        item_id: values.item_id,
        quantity: values.quantity,
        transaction_date: new Date(values.transaction_date).toISOString(),
        remarks: values.remarks || undefined,
      });
      setCreatedId(txn.id);
      toast.success(`Stock-in recorded — ${txn.reference_number}`);
    } catch (err) {
      const detail =
        err instanceof AxiosError
          ? (err.response?.data?.detail as string | undefined)
          : undefined;
      toast.error(detail ?? "Failed to record stock-in");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  async function printPdf() {
    if (!createdId || printLock.current) return;
    printLock.current = true;
    setPrintingPdf(true);
    try {
      const url = await reportsService.getReceivedForm(createdId);
      setPdfUrl(url);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      printLock.current = false;
      setPrintingPdf(false);
    }
  }

  if (createdId) {
    return (
      <AppLayout>
        <PageWrapper title="Stock-In Recorded">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                The receiving transaction was saved successfully.
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
          title="Receiving Report"
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageWrapper
        title="Record Stock-In"
        subtitle="Receive supplies into inventory"
      >
        <Card className="max-w-2xl">
          <CardContent className="pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="item_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Item</FormLabel>
                      <ItemCombobox
                        value={field.value}
                        disabled={submitting || presetItemLoading}
                        selectedLabel={
                          selectedItem
                            ? `${selectedItem.code} — ${selectedItem.name}`
                            : undefined
                        }
                        onSelect={(item) => {
                          field.onChange(item.id);
                          setSelectedItem(item);
                        }}
                      />
                      {presetItemLoading && (
                        <FormDescription className="inline-flex items-center gap-2" role="status" aria-live="polite">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          Loading selected item…
                        </FormDescription>
                      )}
                      {selectedItem && (
                        <FormDescription>
                          Current stock: {selectedItem.quantity}{" "}
                          {selectedItem.unit ?? ""}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Enter quantity"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const digits = e.target.value.replace(
                                /[^0-9]/g,
                                ""
                              );
                              field.onChange(
                                digits === "" ? undefined : Number(digits)
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
                </div>

                <FormItem>
                  <FormLabel>Reference No.</FormLabel>
                  <FormControl>
                    <Input
                      readOnly
                      value="Auto-generated (RCV-YYYY-XXXX)"
                      className="bg-muted text-muted-foreground"
                    />
                  </FormControl>
                </FormItem>

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks</FormLabel>
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
                  <Button type="submit" disabled={submitting || presetItemLoading}>
                    {submitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Record Stock-In
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
