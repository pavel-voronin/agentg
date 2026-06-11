import { describe, expect, it } from 'vitest';
import type { ProceduresOf } from '@agentg/framework';

import type { telegramModule } from '../src/module.js';

describe('telegramModule', () => {
  it('includes status in the typed procedure surface', () => {
    const status: ProceduresOf<typeof telegramModule>['status'] = () => ({
      ready: false
    });

    expect(status()).toEqual({
      ready: false
    });
  });
});
