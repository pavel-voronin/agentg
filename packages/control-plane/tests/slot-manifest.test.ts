import { describe, expect, it } from 'vitest';

import { controlPlaneSlotLayout } from '../src/composition/slots/manifest.js';

describe('slot manifest', () => {
  it('keeps default placements derived from provider tags', () => {
    expect(controlPlaneSlotLayout).toEqual({});
  });
});
