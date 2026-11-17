import { HttpErrorResponse } from '@angular/common/http';

import { ApiError } from './models';

/**
 * Turns any thrown value into a message that can be shown to an operator.
 * The backend always answers errors with `{ error, message }`, so prefer that
 * over the generic status text.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    // A 413 often comes from the reverse proxy (nginx) as an HTML page, so it
    // must not be shown verbatim: explain the limit instead.
    if (error.status === 413) {
      return 'The file is too large for the server (413). Raise the upload limit and try again.';
    }

    const body: unknown = error.error;

    if (typeof body === 'string' && body.trim().length > 0) {
      return body;
    }
    if (body !== null && typeof body === 'object' && 'message' in body) {
      const message = (body as ApiError).message;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }
    if (error.status === 0) {
      return 'Cannot reach the API. Is the backend running?';
    }
    return error.statusText || `Request failed with status ${error.status}`;
  }

  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

/** HTTP status of an `HttpErrorResponse`, or `null` for any other thrown value. */
export function apiErrorStatus(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}
