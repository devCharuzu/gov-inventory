import { api } from "@/lib/api";
import type { AuditLog } from "@/types/audit.types";
import type { PaginatedResponse } from "@/types/pagination.types";

export interface AuditFilters {
  user_id?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  size?: number;
}

export const auditService = {
  async getAuditLogs(
    filters: AuditFilters = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    const { data } = await api.get<PaginatedResponse<AuditLog>>("/audit/", {
      params: filters,
    });
    return data;
  },

  async getActions(): Promise<string[]> {
    const { data } = await api.get<string[]>("/audit/actions");
    return data;
  },

  async deleteLog(id: string): Promise<{ deleted: number }> {
    const { data } = await api.delete<{ deleted: number }>(`/audit/${id}`);
    return data;
  },

  async bulkDeleteLogs(ids: string[]): Promise<{ deleted: number }> {
    const { data } = await api.delete<{ deleted: number }>("/audit/bulk", {
      data: { ids },
    });
    return data;
  },
};
