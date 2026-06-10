import { describe, expect, it } from 'vitest';

import { providerFileUrl } from './mediaUrl.js';

describe('Telegram Dashboard media URLs', () => {
  it('keeps canonical media URLs on the file-server path', () => {
    expect(providerFileUrl('/telegram-files/agentg-media/file.jpg')).toBe(
      '/telegram-files/agentg-media/file.jpg'
    );
  });

  it('rejects non-canonical media URLs', () => {
    expect(providerFileUrl('/telegram-files/raw/file.jpg')).toBeNull();
    expect(
      providerFileUrl('/dashboard/module-files/telegram/telegram-files/agentg-media/file.jpg')
    ).toBeNull();
  });

  it('rejects traversal media URLs', () => {
    expect(providerFileUrl('/telegram-files/agentg-media/%2e%2e/file.jpg')).toBeNull();
    expect(providerFileUrl('/telegram-files/agentg-media/a%2Fb.jpg')).toBeNull();
  });

  it('rejects media URLs with raw query or fragment components', () => {
    expect(providerFileUrl('/telegram-files/agentg-media/file.jpg?token=secret')).toBeNull();
    expect(providerFileUrl('/telegram-files/agentg-media/file.jpg#fragment')).toBeNull();
  });
});
