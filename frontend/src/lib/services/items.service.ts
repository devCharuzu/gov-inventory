import { api } from "@/lib/api";
import type { CreateItemRequest, Item } from "@/types/item.types";
import type { PaginatedResponse } from "@/types/pagination.types";
import type { Transaction } from "@/types/transaction.types";

export interface ItemFilters {
  search?: string;
  category_id?: string;
  is_active?: boolean;
  low_stock?: boolean;
  page?: number;
  size?: number;
}

export type UpdateItemRequest = Partial<CreateItemRequest> & {
  is_active?: boolean;
};

export const itemsService = {
  async getItems(
    filters: ItemFilters = {}
  ): Promise<PaginatedResponse<Item>> {
    const { data } = await api.get<PaginatedResponse<Item>>("/items/", {
      params: filters,
    });
    return data;
  },

  async getItem(id: string): Promise<Item> {
    const { data } = await api.get<Item>(`/items/${id}`);
    return data;
  },

  async createItem(req: CreateItemRequest): Promise<Item> {
    const { data } = await api.post<Item>("/items/", req);
    return data;
  },

  async updateItem(id: string, req: UpdateItemRequest): Promise<Item> {
    const { data } = await api.put<Item>(`/items/${id}`, req);
    return data;
  },

  async deleteItem(id: string): Promise<{ message: string }> {
    const { data } = await api.delete<{ message: string }>(`/items/${id}`);
    return data;
  },

  async hardDeleteItem(id: string): Promise<{ deleted: number }> {
    const { data } = await api.delete<{ deleted: number }>(`/items/${id}/hard`);
    return data;
  },

  async getItemTransactions(
    id: string,
    page = 1,
    size = 20
  ): Promise<PaginatedResponse<Transaction>> {
    const { data } = await api.get<PaginatedResponse<Transaction>>(
      `/items/${id}/transactions`,
      { params: { page, size } }
    );
    return data;
  },

  async getLowStock(): Promise<Item[]> {
    const { data } = await api.get<Item[]>("/items/low-stock");
    return data;
  },
};
