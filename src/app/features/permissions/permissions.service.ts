import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreatePermissionRequest, PermissionDto } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/permissions`;

  async list(): Promise<PermissionDto[]> {
    return firstValueFrom(this.http.get<PermissionDto[]>(this.base));
  }

  async create(payload: CreatePermissionRequest): Promise<PermissionDto> {
    return firstValueFrom(this.http.post<PermissionDto>(this.base, payload));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
