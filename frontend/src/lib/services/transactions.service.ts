import { api } from "@/lib/api";
import type { PaginatedResponse } from "@/types/pagination.types";
import type {
  CreateInRequest,
  CreateOutBatchRequest,
  CreateOutRequest,
  StockOutBatch,
  Transaction,
  TransactionType,
} from "@/types/transaction.types";

export interface TransactionFilters {
  type?: TransactionType;
  item_id?: string;
  reference_number?: string;
  start_date?: string;
  end_date?: string;
  created_by?: string;
  recipient_name?: string;
  recipient_unit?: string;
  item_search?: string;
  page?: number;
  size?: number;
}

export const transactionsService = {
  async getTransactions(
    filters: TransactionFilters = {}
  ): Promise<PaginatedResponse<Transaction>> {
    const { data } = await api.get<PaginatedResponse<Transaction>>(
      "/transactions/",
      { params: filters }
    );
    return data;
  },

  async createIn(req: CreateInRequest): Promise<Transaction> {
    const { data } = await api.post<Transaction>("/transactions/in", req);
    return data;
  },

  async createOut(req: CreateOutRequest): Promise<Transaction> {
    const { data } = await api.post<Transaction>("/transactions/out", req);
    return data;
  },

  async createOutBatch(req: CreateOutBatchRequest): Promise<StockOutBatch> {
    const { data } = await api.post<StockOutBatch>(
      "/transactions/out/batch",
      req
    );
    return data;
  },

  async voidTransaction(id: string): Promise<{ message: string }> {
    const { data } = await api.delete<{ message: string }>(
      `/transactions/${id}`
    );
    return data;
  },

  async hardDeleteTransaction(id: string): Promise<{ deleted: number }> {
    const { data } = await api.delete<{ deleted: number }>(
      `/transactions/hard/${id}`
    );
    return data;
  },

  async bulkDeleteTransactions(ids: string[]): Promise<{ deleted: number }> {
    const { data } = await api.delete<{ deleted: number }>(
      "/transactions/bulk",
      { data: { ids } }
    );
    return data;
  },
};
