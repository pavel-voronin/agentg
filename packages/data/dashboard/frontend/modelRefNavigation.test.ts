import { describe, expect, it } from 'vitest';

import { isModelRouteSafeRef, isTelegramIntegerId } from './modelRefNavigation.js';

describe('model ref navigation', () => {
  it('allows Telegram model links only for integer ids', () => {
    expect(isTelegramIntegerId('-1001449711572')).toBe(true);
    expect(isTelegramIntegerId('agentg-live-validation')).toBe(false);
    expect(isModelRouteSafeRef({ _model: 'telegram.chat', id: 'agentg-live-validation' })).toBe(
      false
    );
    expect(isModelRouteSafeRef({ _model: 'telegram.user', id: '42' })).toBe(true);
  });
});
