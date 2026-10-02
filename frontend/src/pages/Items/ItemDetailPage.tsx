import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Inbox,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";

import { AppLayout, PageWrapper } from "@/components/layout";
import { StatusBadge } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { itemsService } from "@/lib/services/items.service";
import { useAuth } from "@/store/AuthContext";
import type { Item } from "@/types/item.types";
import type { Transaction } from "@/types/transaction.types";

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "encoder";
  const isAdmin = user?.role === "admin";

  const [item, setItem] = useState<Item | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(false);
    Promise.all([
      itemsService.getItem(id),
      itemsService.getItemTransactions(id, 1, 20),
    ])
      .then(([itemData, txnData]) => {
        if (!active) return;
        setItem(itemData);
        setTxns(txnData.items);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <PageWrapper title="Item Details">
          <Skeleton className="h-48 w-full max-w-3xl" />
        </PageWrapper>
      </AppLayout>
    );
  }

  if (error || !item) {
    return (
      <AppLayout>
        <PageWrapper title="Item Details">
          <Alert variant="destructive">
            <AlertTitle>Item not found</AlertTitle>
            <AlertDescription>The item could not be loaded.</AlertDescription>
          </Alert>
        </PageWrapper>
      </AppLayout>
    );
  }

  const low = item.quantity <= item.minimum_quantity;

  return (
    <AppLayout>
      <PageWrapper
        title={item.name}
        subtitle={item.code}
        actions={
          isAdmin && (
            <Button
              variant="outline"
              onClick={() => navigate(`/items/${item.id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )
        }
      >
        {/* Detail card */}
        <Card className="mb-6">
          <CardContent className="grid gap-6 pt-6 md:grid-cols-3">
            {/* Prominent stock */}
            <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-6">
              <p className="text-sm text-muted-foreground">Current Stock</p>
              <p
                className={`text-5xl font-bold ${
                  low ? "text-amber-600" : ""
                }`}
              >
                {item.quantity}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Min: {item.minimum_quantity} {item.unit ?? ""}
              </p>
              {low && (
                <Badge variant="destructive" className="mt-2">
                  Low stock
                </Badge>
              )}
            </div>

            {/* Fields */}
            <dl className="md:col-span-2 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Field label="Category" value={item.category?.name ?? "—"} />
              <Field label="Unit" value={item.unit ?? "—"} />
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <StatusBadge active={item.is_active} />
                </dd>
              </div>
              <Field
                label="Created"
                value={format(new Date(item.created_at), "MMM d, yyyy")}
              />
              <div className="col-span-2">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="mt-1">{item.description || "—"}</dd>
              </div>
            </dl>
          </CardContent>

          {canManage && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2 p-4">
                <Button
                  onClick={() =>
                    navigate(`/transactions/in?item_id=${item.id}`)
                  }
                >
                  <ArrowDownCircle className="mr-2 h-4 w-4" />
                  Record IN
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigate(`/transactions/out?item_id=${item.id}`)
                  }
                >
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  Record OUT
                </Button>
              </div>
            </>
          )}
        </Card>

        {/* Transaction history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {txns.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">No transactions for this item</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref No.</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Party</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">
                        {t.reference_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.transaction_type === "IN"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {t.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{t.quantity}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(t.transaction_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.recipient_name ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageWrapper>
    </AppLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
