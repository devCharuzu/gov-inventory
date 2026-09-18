import { api } from "@/lib/api";

export const backupService = {
  /** Downloads the database backup and triggers a browser save dialog. */
  async download(): Promise<void> {
    const res = await api.get<Blob>("/backup/download", {
      responseType: "blob",
    });
    const disposition = res.headers["content-disposition"] as
      | string
      | undefined;
    const match = disposition?.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? "gov_inventory-backup.db";

    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },
};
