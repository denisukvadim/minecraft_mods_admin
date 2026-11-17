import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AccessResponse,
  CreateUserRequest,
  UpdateUserRequest,
  UserDetail,
  UserSummary,
} from '../../core/models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/users`;

  async list(limit: number, offset: number): Promise<UserSummary[]> {
    return firstValueFrom(this.http.get<UserSummary[]>(this.base, { params: { limit, offset } }));
  }

  async get(id: string): Promise<UserDetail> {
    return firstValueFrom(this.http.get<UserDetail>(`${this.base}/${id}`));
  }

  async create(payload: CreateUserRequest): Promise<UserDetail> {
    return firstValueFrom(this.http.post<UserDetail>(this.base, payload));
  }

  async update(id: string, payload: UpdateUserRequest): Promise<UserDetail> {
    return firstValueFrom(this.http.patch<UserDetail>(`${this.base}/${id}`, payload));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }

  async assignRole(userId: string, roleId: string): Promise<AccessResponse> {
    return firstValueFrom(
      this.http.post<AccessResponse>(`${this.base}/${userId}/roles/${roleId}`, {}),
    );
  }

  async revokeRole(userId: string, roleId: string): Promise<AccessResponse> {
    return firstValueFrom(
      this.http.delete<AccessResponse>(`${this.base}/${userId}/roles/${roleId}`),
    );
  }

  async grantPermission(userId: string, permissionId: string): Promise<AccessResponse> {
    return firstValueFrom(
      this.http.post<AccessResponse>(`${this.base}/${userId}/permissions/${permissionId}`, {}),
    );
  }

  async revokePermission(userId: string, permissionId: string): Promise<AccessResponse> {
    return firstValueFrom(
      this.http.delete<AccessResponse>(`${this.base}/${userId}/permissions/${permissionId}`),
    );
  }
}
