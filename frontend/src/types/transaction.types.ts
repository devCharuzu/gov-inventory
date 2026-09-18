import type { User } from "./auth.types";
import type { Item } from "./item.types";

export type TransactionType = "IN" | "OUT";

export interface Transaction {
  id: string;
  transaction_type: TransactionType;
  reference_number: string;
  item_id: string;
  item: Item;
  quantity: number;
  recipient_name?: string | null;
  recipient_department?: string | null;
  purpose?: string | null;
  condition?: string | null;
  remarks?: string | null;
  transaction_date: string;
  created_by: string;
  creator: User;
  voided: boolean;
  created_at: string;
}

export interface CreateInRequest {
  item_id: string;
  quantity: number;
  condition?: string;
  transaction_date: string;
  remarks?: string;
}

export interface CreateOutRequest {
  item_id: string;
  quantity: number;
  recipient_name: string;
  recipient_department?: string;
  purpose?: string;
  transaction_date: string;
  remarks?: string;
}
