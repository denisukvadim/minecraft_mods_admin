import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ModFileActionDto } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  async actions(limit: number, offset: number): Promise<ModFileActionDto[]> {
    return firstValueFrom(
      this.http.get<ModFileActionDto[]>(`${this.base}/mod-actions`, {
        params: { limit, offset },
      }),
    );
  }

  async history(fileName: string, limit: number, offset: number): Promise<ModFileActionDto[]> {
    return firstValueFrom(
      this.http.get<ModFileActionDto[]>(
        `${this.base}/mods/${encodeURIComponent(fileName)}/history`,
        { params: { limit, offset } },
      ),
    );
  }
}
