import { describe, expect, it } from 'vitest';

import { mutation, query, surface } from '../src/surface.js';

describe('surface', () => {
  it('compiles one procedure source into manifest records and runtime handlers', () => {
    type Runtime = {
      setValue: (value: number) => number;
      value: number;
    };

    const rpcSurface = surface('alpha', {
      getValue: query((runtime: Runtime) => () => runtime.value),
      setValue: mutation((runtime: Runtime) => runtime.setValue)
    });

    expect(rpcSurface.procedures()).toEqual([
      { kind: 'query', name: 'alpha.getValue' },
      { kind: 'mutation', name: 'alpha.setValue' }
    ]);

    const router = rpcSurface.router({
      setValue: (value: number) => value + 1,
      value: 3
    });

    expect(router.getValue()).toBe(3);
    expect(router.setValue(4)).toBe(5);
  });
});
