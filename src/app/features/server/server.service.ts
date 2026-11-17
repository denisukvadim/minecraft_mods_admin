import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ServerLogsDto, ServerStatusDto } from '../../core/models';

/** Thin wrapper around the backend's `/server/*` endpoints (Portainer proxy). */
@Injectable({ providedIn: 'root' })
export class ServerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/server`;

  async status(): Promise<ServerStatusDto> {
    return firstValueFrom(this.http.get<ServerStatusDto>(`${this.base}/status`));
  }

  async start(): Promise<ServerStatusDto> {
    return firstValueFrom(this.http.post<ServerStatusDto>(`${this.base}/start`, null));
  }

  async stop(timeout = 60): Promise<ServerStatusDto> {
    return firstValueFrom(
      this.http.post<ServerStatusDto>(`${this.base}/stop`, null, { params: { timeout } }),
    );
  }

  async restart(timeout = 60): Promise<ServerStatusDto> {
    return firstValueFrom(
      this.http.post<ServerStatusDto>(`${this.base}/restart`, null, { params: { timeout } }),
    );
  }

  async logs(tail = 300, timestamps = true): Promise<ServerLogsDto> {
    return firstValueFrom(
      this.http.get<ServerLogsDto>(`${this.base}/logs`, { params: { tail, timestamps } }),
    );
  }
}
