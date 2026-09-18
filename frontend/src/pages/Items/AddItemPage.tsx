import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AxiosError } from "axios";

import { AppLayout, PageWrapper } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { itemsService } from "@/lib/services/items.service";
import ItemForm, { type ItemFormValues } from "./ItemForm";

export default function AddItemPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: ItemFormValues) {
    setSubmitting(true);
    try {
      await itemsService.createItem({
        name: values.name,
        category_id: values.category_id,
        unit: values.unit,
        description: values.description || undefined,
        minimum_quantity: values.minimum_quantity,
      });
      toast.success("Item created");
      navigate("/items");
    } catch (err) {
      const detail =
        err instanceof AxiosError
          ? (err.response?.data?.detail as string | undefined)
          : undefined;
      toast.error(detail ?? "Failed to create item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <PageWrapper title="Add Item" subtitle="Register a new inventory item">
        <Card className="max-w-2xl">
          <CardContent className="pt-6">
            <ItemForm
              mode="create"
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={() => navigate("/items")}
            />
          </CardContent>
        </Card>
      </PageWrapper>
    </AppLayout>
  );
}
