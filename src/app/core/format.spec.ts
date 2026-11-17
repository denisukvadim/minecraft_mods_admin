import { actorLabel, formatBytes } from './format';

describe('formatBytes', () => {
  it('keeps small sizes in bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('scales to the next unit', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB');
  });

  it('handles invalid input', () => {
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('actorLabel', () => {
  it('prefers the username and falls back to the email', () => {
    expect(actorLabel({ username: 'steve', user_email: 's@example.com' })).toBe('steve');
    expect(actorLabel({ username: null, user_email: 's@example.com' })).toBe('s@example.com');
    expect(actorLabel({ username: null, user_email: null })).toBe('deleted account');
  });
});
