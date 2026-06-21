import { describe, expect, it } from 'vitest';

import { providerResultSchema, providerRunResultSchema } from './schema.js';

describe('provider result schema', () => {
  it('accepts async accepted action results', () => {
    expect(
      providerResultSchema.parse({
        runId: 'provider-run-1',
        status: 'accepted'
      })
    ).toEqual({
      runId: 'provider-run-1',
      status: 'accepted'
    });
  });

  it('keeps provider run reads in a separate schema', () => {
    expect(
      providerRunResultSchema.parse({
        runId: 'provider-run-1',
        status: 'processing'
      })
    ).toEqual({
      runId: 'provider-run-1',
      status: 'processing'
    });
    expect(() =>
      providerResultSchema.parse({
        runId: 'provider-run-1',
        status: 'processing'
      })
    ).toThrow();
  });
});
