import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoriesService } from "@/lib/services/categories.service";
import type { Category } from "@/types/category.types";

export const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "pc", label: "Piece" },
  { value: "unit", label: "Unit" },
  { value: "set", label: "Set" },
  { value: "pair", label: "Pair" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "ream", label: "Ream" },
  { value: "bundle", label: "Bundle" },
  { value: "roll", label: "Roll" },
  { value: "sheet", label: "Sheet" },
  { value: "pad", label: "Pad" },
  { value: "bottle", label: "Bottle" },
  { value: "can", label: "Can" },
  { value: "gallon", label: "Gallon" },
  { value: "liter", label: "Liter" },
  { value: "kilogram", label: "Kilogram" },
  { value: "gram", label: "Gram" },
  { value: "sack", label: "Sack" },
  { value: "bag", label: "Bag" },
  { value: "meter", label: "Meter" },
  { value: "carton", label: "Carton" },
  { value: "jar", label: "Jar" },
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
];

export const itemFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category_id: z.string().min(1, "Category is required"),
  unit: z.string().min(1, "Unit is required"),
  description: z.string().optional(),
  minimum_quantity: z
    .number({ message: "Minimum quantity is required" })
    .int("Whole numbers only")
    .min(0, "Must be 0 or greater"),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

interface ItemFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<ItemFormValues>;
  /** Existing code shown read-only when editing. */
  code?: string;
  submitting?: boolean;
  onSubmit: (values: ItemFormValues) => void | Promise<void>;
  onCancel?: () => void;
}

export default function ItemForm({
  mode,
  defaultValues,
  code,
  submitting = false,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: "",
      category_id: "",
      unit: "",
      description: "",
      minimum_quantity: undefined as unknown as number,
      ...defaultValues,
    },
  });

  useEffect(() => {
    // Fetch all categories (not only active) so an item's existing category
    // always resolves to its name in the dropdown when editing.
    categoriesService
      .getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Code: auto-suggested on create, read-only on edit */}
        <FormItem>
          <FormLabel>Item Code</FormLabel>
          <FormControl>
            <Input
              readOnly
              value={mode === "edit" ? (code ?? "") : "Auto-generated (ITM-XXXX)"}
              className="bg-muted text-muted-foreground"
            />
          </FormControl>
          <FormDescription>
            {mode === "edit"
              ? "Item codes cannot be changed."
              : "A unique code is assigned automatically on save."}
          </FormDescription>
        </FormItem>

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
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || undefined}
                disabled={submitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category">
                      {(val) => categories.find((c) => c.id === val)?.name ?? ""}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || undefined}
                  disabled={submitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a unit">
                        {(val) => UNIT_OPTIONS.find((u) => u.value === val)?.label ?? ""}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minimum_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter minimum quantity"
                    disabled={submitting}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "");
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
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input disabled={submitting} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Item" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
