import { api } from "@/lib/api";
import type {
  LoginRequest,
  LoginResponse,
  User,
} from "@/types/auth.types";
import type { PaginatedResponse } from "@/types/pagination.types";

export interface CreateUserRequest {
  username: string;
  full_name: string;
  role: User["role"];
  password: string;
}

export interface UpdateUserRequest {
  role?: User["role"];
  is_active?: boolean;
}

export const authService = {
  async login(req: LoginRequest): Promise<LoginResponse> {
    // The backend uses OAuth2PasswordRequestForm -> form-encoded body.
    const body = new URLSearchParams();
    body.append("username", req.username);
    body.append("password", req.password);
    const { data } = await api.post<LoginResponse>("/auth/login", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },

  async logout(): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>("/auth/logout");
    return data;
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },

  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>(
      "/auth/change-password",
      { old_password: oldPassword, new_password: newPassword }
    );
    return data;
  },

  async getUsers(
    page = 1,
    size = 20
  ): Promise<PaginatedResponse<User>> {
    const { data } = await api.get<PaginatedResponse<User>>("/auth/users", {
      params: { page, size },
    });
    return data;
  },

  async createUser(req: CreateUserRequest): Promise<User> {
    const { data } = await api.post<User>("/auth/users", req);
    return data;
  },

  async updateUser(id: string, req: UpdateUserRequest): Promise<User> {
    const { data } = await api.put<User>(`/auth/users/${id}`, req);
    return data;
  },

  async deleteUser(id: string, password: string): Promise<{ message: string }> {
    const { data } = await api.delete<{ message: string }>(
      `/auth/users/${id}`,
      { data: { password } }
    );
    return data;
  },

  async updateProfile(payload: {
    full_name?: string;
    position?: string;
  }): Promise<User> {
    const { data } = await api.put<User>("/auth/me", payload);
    return data;
  },
};
