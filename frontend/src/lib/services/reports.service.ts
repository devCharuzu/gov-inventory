import { api } from "@/lib/api";
import type { TransactionType } from "@/types/transaction.types";

export interface TransactionHistoryParams {
  start_date?: string;
  end_date?: string;
  type?: TransactionType;
  item_id?: string;
  item_search?: string;
  recipient_name?: string;
  recipient_unit?: string;
  transaction_ids?: string;
}

export interface AnalyticsReportParams {
  period?: "weekly" | "monthly" | "semester";
  year?: number;
  start_date?: string;
  end_date?: string;
}

export interface StockCardParams {
  item_id: string;
  start_date?: string;
  end_date?: string;
}

export interface StoredReport {
  name: string;
  size: number;
  modified: string;
}

async function fetchPdfUrl(
  url: string,
  params?: TransactionHistoryParams | AnalyticsReportParams | StockCardParams
): Promise<string> {
  const { data } = await api.get<Blob>(url, {
    params,
    responseType: "blob",
  });
  const blob = new Blob([data], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

export const reportsService = {
  /** Live Appendix 38 stock card with receipt, issue, and running balances. */
  getStockCard(params: StockCardParams): Promise<string> {
    return fetchPdfUrl("/reports/stock-card", params);
  },

  /** Returns an object URL for the requisition/issue slip PDF (OUT txn). */
  getRequestForm(transactionId: string): Promise<string> {
    return fetchPdfUrl(`/reports/request-form/${transactionId}`);
  },

  /** Returns a combined PDF of matching stock-out request and issue slips. */
  getRequestForms(params: TransactionHistoryParams = {}): Promise<string> {
    return fetchPdfUrl("/reports/request-forms", params);
  },

  /** Returns an object URL for the receiving report PDF (IN txn). */
  getReceivedForm(transactionId: string): Promise<string> {
    return fetchPdfUrl(`/reports/received-form/${transactionId}`);
  },

  /** Returns an object URL for the filtered transaction-history PDF. */
  getTransactionHistory(
    params: TransactionHistoryParams = {}
  ): Promise<string> {
    return fetchPdfUrl("/reports/transaction-history", params);
  },

  /** Returns an object URL for the combined analytics report PDF. */
  getAnalyticsReport(params: AnalyticsReportParams = {}): Promise<string> {
    return fetchPdfUrl("/reports/analytics-report", params);
  },

  /** Lists persisted transaction report files (newest first). */
  async listStoredReports(): Promise<StoredReport[]> {
    const { data } = await api.get<StoredReport[]>("/reports/files");
    return data;
  },

  /** Returns an object URL for a stored transaction report PDF. */
  getStoredReport(name: string): Promise<string> {
    return fetchPdfUrl(`/reports/files/${encodeURIComponent(name)}`);
  },

  /** Delete a single stored report file. */
  async deleteStoredReport(name: string): Promise<void> {
    await api.delete(`/reports/files/${encodeURIComponent(name)}`);
  },

  /** Delete multiple stored report files. */
  async deleteStoredReports(names: string[]): Promise<number> {
    const { data } = await api.delete<{ deleted: number }>("/reports/files", {
      data: { names },
    });
    return data.deleted;
  },
};
