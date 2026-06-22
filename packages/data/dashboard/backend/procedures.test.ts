import { describe, expect, it, vi } from 'vitest';

import { METHODS } from '../contracts.js';
import { createProcedures } from './procedures.js';

describe('data dashboard procedures', () => {
  it('registers explicit Dashboard procedures backed by the Data client', async () => {
    const client = {
      browseAnnotations: vi.fn(() => Promise.resolve(page())),
      browseCollection: vi.fn(() => Promise.resolve(page())),
      overview: vi.fn(() => Promise.resolve({ catalog: [], derivedStorage: derivedStorage() })),
      selectPage: vi.fn(() => Promise.resolve(page()))
    };
    const procedures = createProcedures({
      client: client as unknown as Parameters<typeof createProcedures>[0]['client']
    });
    const overview = requireProcedure(procedures, METHODS.overview);
    const browseAnnotations = requireProcedure(procedures, METHODS.browseAnnotations);
    const browseCollection = requireProcedure(procedures, METHODS.browseCollection);
    const selectPage = requireProcedure(procedures, METHODS.selectPage);

    expect(Object.keys(procedures).sort()).toEqual(Object.values(METHODS).sort());
    await expect(overview({ ignored: true })).resolves.toMatchObject({
      catalog: []
    });
    await expect(selectPage({ model: 'telegram.chat' })).resolves.toEqual(page());
    await expect(browseAnnotations({ key: 'summary' })).resolves.toEqual(page());
    await expect(browseCollection({ key: 'subjects' })).resolves.toEqual(page());
    expect(client.overview).toHaveBeenCalledWith();
    expect(client.selectPage).toHaveBeenCalledWith({ model: 'telegram.chat' });
    expect(client.browseAnnotations).toHaveBeenCalledWith({ key: 'summary' });
    expect(client.browseCollection).toHaveBeenCalledWith({ key: 'subjects' });
  });
});

function derivedStorage() {
  return {
    annotations: {
      byKey: [],
      bySubjectModel: [],
      recent: [],
      totalItems: 0
    },
    collectionItems: {
      byKey: [],
      bySubjectModel: [],
      recent: [],
      totalItems: 0
    }
  };
}

function page() {
  return {
    hasMore: false,
    rows: [],
    total: 0
  };
}

function requireProcedure(
  procedures: Record<string, (input: unknown) => Promise<unknown>>,
  method: string
): (input: unknown) => Promise<unknown> {
  const procedure = procedures[method];
  if (procedure === undefined) {
    throw new Error(`Missing procedure: ${method}`);
  }
  return procedure;
}
