import { api } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/config/api.config';
import { unwrapList } from '@/lib/api/unwrap';
import type { Department, CreateDepartmentDto, UpdateDepartmentDto } from '@/types/hr.types';

export class DepartmentService {
  static async getAll(): Promise<Department[]> {
    const response = await api.get<any>(API_ENDPOINTS.DEPARTMENT.GET_ALL);
    return unwrapList<Department>(response.data);
  }

  static async create(dto: CreateDepartmentDto): Promise<void> {
    await api.post(API_ENDPOINTS.DEPARTMENT.CREATE, dto);
  }

  static async update(id: string, dto: UpdateDepartmentDto): Promise<void> {
    await api.put(API_ENDPOINTS.DEPARTMENT.UPDATE(id), dto);
  }

}
