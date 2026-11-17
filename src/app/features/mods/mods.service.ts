import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ModFileDto } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class ModsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/mods`;

  async list(limit: number, offset: number): Promise<ModFileDto[]> {
    return firstValueFrom(this.http.get<ModFileDto[]>(this.base, { params: { limit, offset } }));
  }

  /** Multipart upload with progress, reported as 0–100. */
  async upload(file: File, onProgress: (percent: number) => void): Promise<ModFileDto> {
    const form = new FormData();
    form.append('file', file);

    const events$ = this.http
      .post<ModFileDto>(this.base, form, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        tap((event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total ?? file.size;
            onProgress(total > 0 ? Math.round((event.loaded / total) * 100) : 0);
          }
        }),
      );

    const response = await firstValueFrom(
      events$.pipe(
        filter((event): event is HttpResponse<ModFileDto> => event.type === HttpEventType.Response),
      ),
    );

    if (!response.body) {
      throw new Error('The API returned an empty response.');
    }
    return response.body;
  }

  /** Downloads through HttpClient so the bearer token is attached. */
  async download(fileName: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.get(`${this.base}/${encodeURIComponent(fileName)}/download`, {
        observe: 'response',
        responseType: 'blob',
      }),
    );
    if (!response.body) {
      throw new Error('The API returned an empty file.');
    }

    const url = URL.createObjectURL(response.body);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Give the browser a moment to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async remove(fileName: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.base}/${encodeURIComponent(fileName)}`));
  }
}
