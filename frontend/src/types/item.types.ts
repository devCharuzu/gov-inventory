import type { Category } from "./category.types";

export interface Item {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category?: Category | null;
  unit: string | null;
  quantity: number;
  minimum_quantity: number;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateItemRequest {
  name: string;
  category_id: string;
  unit: string;
  description?: string;
  minimum_quantity: number;
  location?: string;
}
