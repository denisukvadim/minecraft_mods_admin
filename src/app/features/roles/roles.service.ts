import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreateRoleRequest, RoleDto, UpdateRoleRequest } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/roles`;

  async list(): Promise<RoleDto[]> {
    return firstValueFrom(this.http.get<RoleDto[]>(this.base));
  }

  async create(payload: CreateRoleRequest): Promise<RoleDto> {
    return firstValueFrom(this.http.post<RoleDto>(this.base, payload));
  }

  async update(id: string, payload: UpdateRoleRequest): Promise<RoleDto> {
    return firstValueFrom(this.http.patch<RoleDto>(`${this.base}/${id}`, payload));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }

  async replacePermissions(id: string, permissions: string[]): Promise<RoleDto> {
    return firstValueFrom(
      this.http.put<RoleDto>(`${this.base}/${id}/permissions`, { permissions }),
    );
  }
}
