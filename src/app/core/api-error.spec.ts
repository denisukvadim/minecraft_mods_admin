import { HttpErrorResponse } from '@angular/common/http';

import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  it('explains a proxy 413 instead of echoing its HTML page', () => {
    const error = new HttpErrorResponse({
      status: 413,
      statusText: 'Payload Too Large',
      error: '<html><body><h1>413 Request Entity Too Large</h1></body></html>',
    });

    expect(apiErrorMessage(error)).toContain('too large');
    expect(apiErrorMessage(error)).not.toContain('<html>');
  });

  it('uses the backend message when present', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { error: 'conflict', message: 'file already exists' },
    });

    expect(apiErrorMessage(error)).toBe('file already exists');
  });

  it('falls back to the status text', () => {
    const error = new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' });

    expect(apiErrorMessage(error)).toBe('Internal Server Error');
  });
});
