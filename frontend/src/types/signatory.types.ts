export interface Signatory {
  id: string;
  full_name: string;
  designation: string;
  unit: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SignatoryCreate {
  full_name: string;
  designation: string;
  unit?: string;
}

export interface SignatorySettings {
  certifier_id: string | null;
  issuer_id: string | null;
  region: string | null;
}
