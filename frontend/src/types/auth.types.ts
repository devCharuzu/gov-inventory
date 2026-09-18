export type UserRole = "admin" | "encoder" | "viewer";

export interface User {
  id: string;
  username: string;
  full_name: string;
  position: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  /** True only for the original system-seeded admin — cannot be deleted, demoted, or deactivated. */
  is_main_admin: boolean;
  /** True while the account still uses the blank/default password — UI must prompt to set one. */
  must_change_password: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
