import { api } from "@/lib/api";
import type {
  CategoryBreakdown,
  SummaryStats,
  TopItem,
  TrendDataPoint,
} from "@/types/analytics.types";
import type { TransactionType } from "@/types/transaction.types";

export interface TrendsParams {
  period?: "weekly" | "monthly" | "semester";
  year?: number;
  start_date?: string;
  end_date?: string;
}

export interface TopItemsParams {
  type?: TransactionType;
  limit?: number;
  start_date?: string;
  end_date?: string;
}

export interface StockMovementParams {
  item_id: string;
  start_date?: string;
  end_date?: string;
}

export interface StockMovementPoint {
  date: string;
  quantity_in: number;
  quantity_out: number;
  running_balance: number;
}

export const analyticsService = {
  async getSummary(): Promise<SummaryStats> {
    const { data } = await api.get<SummaryStats>("/analytics/summary");
    return data;
  },

  async getTrends(params: TrendsParams = {}): Promise<TrendDataPoint[]> {
    const { data } = await api.get<TrendDataPoint[]>("/analytics/trends", {
      params,
    });
    return data;
  },

  async getTopItems(params: TopItemsParams = {}): Promise<TopItem[]> {
    const { data } = await api.get<TopItem[]>("/analytics/top-items", {
      params,
    });
    return data;
  },

  async getStockMovement(
    params: StockMovementParams
  ): Promise<StockMovementPoint[]> {
    const { data } = await api.get<StockMovementPoint[]>(
      "/analytics/stock-movement",
      { params }
    );
    return data;
  },

  async getCategoryBreakdown(): Promise<CategoryBreakdown[]> {
    const { data } = await api.get<CategoryBreakdown[]>(
      "/analytics/category-breakdown"
    );
    return data;
  },
};
