export interface SummaryStats {
  total_items: number;
  total_in_today: number;
  total_out_today: number;
  low_stock_count: number;
}

export interface TrendDataPoint {
  period_label: string;
  total_in: number;
  total_out: number;
  net: number;
}

export interface TopItem {
  item_id: string;
  item_name: string;
  item_code: string;
  total_quantity: number;
  transaction_count: number;
}

export interface TopRequestingUnit {
  unit_name: string;
  request_count: number;
  total_quantity: number;
}

export interface CategoryBreakdown {
  category_id: string | null;
  category_name: string;
  item_count: number;
  total_in: number;
  total_out: number;
}
