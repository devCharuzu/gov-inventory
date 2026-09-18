import { api } from "@/lib/api";
import type {
  Signatory,
  SignatoryCreate,
  SignatorySettings,
} from "@/types/signatory.types";

export const signatoriesService = {
  list(): Promise<Signatory[]> {
    return api.get<Signatory[]>("/signatories/").then((r) => r.data);
  },

  create(payload: SignatoryCreate): Promise<Signatory> {
    return api.post<Signatory>("/signatories/", payload).then((r) => r.data);
  },

  update(
    id: string,
    payload: Partial<SignatoryCreate & { is_active: boolean }>
  ): Promise<Signatory> {
    return api.put<Signatory>(`/signatories/${id}`, payload).then((r) => r.data);
  },

  remove(id: string): Promise<void> {
    return api.delete(`/signatories/${id}`).then(() => undefined);
  },

  getSettings(): Promise<SignatorySettings> {
    return api.get<SignatorySettings>("/signatories/settings").then((r) => r.data);
  },

  updateSettings(payload: Partial<SignatorySettings>): Promise<SignatorySettings> {
    return api
      .put<SignatorySettings>("/signatories/settings", payload)
      .then((r) => r.data);
  },
};
