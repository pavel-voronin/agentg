import { describe, expect, it } from 'vitest';

import { storageReviewButtons } from '../src/tdlib-docs/storageReviewDisplay.js';
import type { StorageReviewEntry } from '../src/tdlib-docs/storageReviewTypes.js';

describe('TDLib storage review display state', () => {
  it('returns one button per review sorted by maturity', () => {
    const entry = createEntry([
      createReview({ maturity: 2 }),
      createReview({ maturity: 1 }),
      createReview({ maturity: 1, notes: ['tighten owner wording'] })
    ]);

    expect(
      storageReviewButtons(entry).map((button) => ({
        index: button.index,
        label: button.label
      }))
    ).toEqual([
      { index: 1, label: '1' },
      { index: 2, label: '1' },
      { index: 0, label: '2' }
    ]);
  });

  it('encodes note and alert states per review', () => {
    const entry = createEntry(
      [
        createReview({
          notes: ['check nested file owner', 'owner path is underspecified']
        }),
        createReview({ maturity: 2, status: 'blocked' }),
        createReview({ maturity: 3 })
      ],
      {
        reviewIssues: [{ index: 2, issues: ['review.rejectedStorage.table must be non-empty'] }]
      }
    );

    expect(
      storageReviewButtons(entry).map((button) => ({
        hasAlert: button.hasAlert,
        hasNotes: button.hasNotes,
        index: button.index,
        label: button.label,
        noteCount: button.noteCount
      }))
    ).toEqual([
      {
        hasAlert: false,
        hasNotes: true,
        index: 0,
        label: '1',
        noteCount: 2
      },
      {
        hasAlert: true,
        hasNotes: false,
        index: 1,
        label: '2',
        noteCount: 0
      },
      {
        hasAlert: true,
        hasNotes: false,
        index: 2,
        label: '3',
        noteCount: 0
      }
    ]);
  });

  it('keeps malformed review maturity buttons after valid maturities', () => {
    const entry = createEntry([
      createReview({ maturity: 2 }),
      {
        ...createReview({ maturity: 1 }),
        maturity: 4
      }
    ]);

    expect(storageReviewButtons(entry).map((button) => button.label)).toEqual(['2', '?']);
  });
});

function createEntry(
  reviews: unknown[],
  overrides: Partial<StorageReviewEntry> = {}
): StorageReviewEntry {
  return {
    maturity: 1,
    reviewIssues: [],
    reviews,
    storage: 'embedded',
    storageTarget: 'Chat.photo',
    type: 'ChatPhoto',
    ...overrides
  };
}

function createReview(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    constructors: [],
    decision: 'ChatPhoto is embedded under Chat.photo.',
    maturity: 1,
    notes: [],
    openQuestions: [],
    rejectedStorage: {},
    schema: 'storage-decision',
    status: 'done',
    uses: {
      directTypeUse: [],
      directUpdateUse: [],
      indirectTypeUse: [],
      indirectUpdateUse: [],
      procedureUse: []
    },
    ...overrides
  };
}
