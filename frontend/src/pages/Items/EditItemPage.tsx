import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AxiosError } from "axios";

import { AppLayout, PageWrapper } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { itemsService } from "@/lib/services/items.service";
import type { Item } from "@/types/item.types";
import ItemForm, { type ItemFormValues } from "./ItemForm";

export default function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(false);
    itemsService
      .getItem(id)
      .then((data) => active && setItem(data))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  async function handleSubmit(values: ItemFormValues) {
    if (!id) return;
    setSubmitting(true);
    try {
      await itemsService.updateItem(id, {
        name: values.name,
        category_id: values.category_id,
        unit: values.unit,
        description: values.description || undefined,
        minimum_quantity: values.minimum_quantity,
      });
      toast.success("Item updated");
      navigate(`/items/${id}`);
    } catch (err) {
      const detail =
        err instanceof AxiosError
          ? (err.response?.data?.detail as string | undefined)
          : undefined;
      toast.error(detail ?? "Failed to update item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <PageWrapper title="Edit Item" subtitle={item?.name}>
        <Card className="max-w-2xl">
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error || !item ? (
              <Alert variant="destructive">
                <AlertTitle>Item not found</AlertTitle>
                <AlertDescription>
                  The item could not be loaded.
                </AlertDescription>
              </Alert>
            ) : (
              <ItemForm
                mode="edit"
                code={item.code}
                submitting={submitting}
                defaultValues={{
                  name: item.name,
                  category_id: item.category_id ?? "",
                  unit: item.unit ?? "",
                  description: item.description ?? "",
                  minimum_quantity: item.minimum_quantity,
                }}
                onSubmit={handleSubmit}
                onCancel={() => navigate(`/items/${id}`)}
              />
            )}
          </CardContent>
        </Card>
      </PageWrapper>
    </AppLayout>
  );
}
