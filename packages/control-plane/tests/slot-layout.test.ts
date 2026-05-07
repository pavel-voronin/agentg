import { describe, expect, it } from 'vitest';
import type { ContentProvider } from '@agentg/control-plane-sdk/slots';

import { defaultLayoutFromProviders } from '../src/composition/slots/layout.js';

const componentModule = { default: {} };

describe('slot layout', () => {
  it('builds the default layout from content declarations', () => {
    const providers = [
      {
        contents: [
          {
            contentId: 'owner.primary',
            defaultSlotIds: ['shell.primary'],
            load: () => Promise.resolve(componentModule),
            tags: ['shell.primary']
          },
          {
            contentId: 'owner.secondary',
            defaultSlotIds: ['shell.secondary'],
            load: () => Promise.resolve(componentModule),
            tags: ['shell.secondary']
          }
        ],
        defaultPlacements: [
          {
            contentId: 'owner.secondary',
            slotId: 'shell.preview'
          }
        ],
        domainId: 'owner'
      }
    ] satisfies readonly ContentProvider[];

    expect(defaultLayoutFromProviders(providers)).toEqual({
      'shell.preview': {
        contentId: 'owner.secondary'
      },
      'shell.primary': {
        contentId: 'owner.primary'
      },
      'shell.secondary': {
        contentId: 'owner.secondary'
      }
    });
  });

  it('rejects duplicate default content for one slot', () => {
    const providers = [
      {
        contents: [
          {
            contentId: 'owner.first',
            defaultSlotIds: ['shell.primary'],
            load: () => Promise.resolve(componentModule),
            tags: ['shell.primary']
          },
          {
            contentId: 'owner.second',
            defaultSlotIds: ['shell.primary'],
            load: () => Promise.resolve(componentModule),
            tags: ['shell.primary']
          }
        ],
        domainId: 'owner'
      }
    ] satisfies readonly ContentProvider[];

    expect(() => defaultLayoutFromProviders(providers)).toThrow(
      'Duplicate default content for slot: shell.primary'
    );
  });
});
