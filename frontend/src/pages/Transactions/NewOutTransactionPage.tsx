import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AxiosError } from "axios";
import { FileText, Loader2 } from "lucide-react";
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

const schema = z.object({
  item_id: z.string().min(1, "Item is required"),
  quantity: z
    .number({ message: "Quantity is required" })
    .int("Whole numbers only")
    .min(1, "Must be at least 1"),
  recipient_name: z.string().min(1, "Recipient name is required"),
  recipient_department: z.string().optional(),
  transaction_date: z.string().min(1, "Date is required"),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const today = () => new Date().toISOString().slice(0, 10);

export default function NewOutTransactionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetItemId = params.get("item_id") ?? "";

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      item_id: presetItemId,
      quantity: undefined as unknown as number,
      recipient_name: "",
      recipient_department: "",
      transaction_date: today(),
      remarks: "",
    },
  });

  useEffect(() => {
    if (presetItemId) {
      itemsService
        .getItem(presetItemId)
        .then(setSelectedItem)
        .catch(() => undefined);
    }
  }, [presetItemId]);

  const quantity = form.watch("quantity");
  const available = selectedItem?.quantity ?? 0;
  const exceeds = !!selectedItem && typeof quantity === "number" && quantity > available;

  async function onSubmit(values: FormValues) {
    if (exceeds) {
      form.setError("quantity", { message: `Only ${available} in stock` });
      return;
    }
    setSubmitting(true);
    try {
      const txn = await transactionsService.createOut({
        item_id: values.item_id,
        quantity: values.quantity,
        recipient_name: values.recipient_name,
        recipient_department: values.recipient_department || undefined,
        transaction_date: new Date(values.transaction_date).toISOString(),
        remarks: values.remarks || undefined,
      });
      setCreatedId(txn.id);
      toast.success(`Stock-out recorded — ${txn.reference_number}`);
    } catch (err) {
      const detail =
        err instanceof AxiosError
          ? (err.response?.data?.detail as string | undefined)
          : undefined;
      toast.error(detail ?? "Failed to record stock-out");
    } finally {
      setSubmitting(false);
    }
  }

  async function printPdf() {
    if (!createdId) return;
    try {
      const url = await reportsService.getRequestForm(createdId);
      setPdfUrl(url);
    } catch {
      toast.error("Failed to generate PDF");
    }
  }

  if (createdId) {
    return (
      <AppLayout>
        <PageWrapper title="Stock-Out Recorded">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                The release transaction was saved successfully.
              </p>
              <div className="flex gap-2">
                <Button onClick={printPdf}>
                  <FileText className="mr-2 h-4 w-4" />
                  Print PDF
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
                <FormField
                  control={form.control}
                  name="item_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Item</FormLabel>
                      <ItemCombobox
                        value={field.value}
                        selectedLabel={
                          selectedItem
                            ? `${selectedItem.code} — ${selectedItem.name}`
                            : undefined
                        }
                        onSelect={(item) => {
                          field.onChange(item.id);
                          setSelectedItem(item);
                          form.trigger("quantity");
                        }}
                      />
                      {selectedItem && (
                        <FormDescription>
                          Available: {available} {selectedItem.unit ?? ""}
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
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/[^0-9]/g, "");
                              field.onChange(
                                digits === "" ? undefined : Number(digits)
                              );
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        {exceeds ? (
                          <p className="text-sm font-medium text-destructive">
                            Quantity exceeds available stock ({available})
                          </p>
                        ) : (
                          <FormMessage />
                        )}
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
                            placeholder="Auto-filled from employee"
                            {...field}
                          />
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
                  <Button type="submit" disabled={submitting || exceeds}>
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
