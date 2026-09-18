import { api } from "@/lib/api";
import type { Category } from "@/types/category.types";

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest> & {
  is_active?: boolean;
};

export const categoriesService = {
  async getCategories(is_active?: boolean): Promise<Category[]> {
    const { data } = await api.get<Category[]>("/categories/", {
      params: is_active === undefined ? {} : { is_active },
    });
    return data;
  },

  async createCategory(req: CreateCategoryRequest): Promise<Category> {
    const { data } = await api.post<Category>("/categories/", req);
    return data;
  },

  async updateCategory(
    id: string,
    req: UpdateCategoryRequest
  ): Promise<Category> {
    const { data } = await api.put<Category>(`/categories/${id}`, req);
    return data;
  },

  async deleteCategory(id: string): Promise<{ message: string }> {
    const { data } = await api.delete<{ message: string }>(
      `/categories/${id}`
    );
    return data;
  },
};
