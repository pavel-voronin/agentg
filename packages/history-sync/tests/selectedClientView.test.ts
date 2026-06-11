import { describe, expect, it } from 'vitest';

import {
  selectedClientView,
  selectedMutationErrorMessage
} from '../dashboard/frontend/selectedClientView.js';
import type { SelectedHistorySyncState } from '../dashboard/frontend/views.js';

const selectedState: SelectedHistorySyncState = {
  chat: {
    historySyncBeginningReached: false,
    historySyncStartAt: null,
    id: 'chat-a',
    isBot: false,
    messageCount: 12,
    title: 'Alice',
    type: 'private',
    updatedAt: '2026-06-11T00:00:00.000Z'
  },
  coverage: [],
  desired: [],
  missing: [],
  targets: []
};

describe('selected History Sync client view', () => {
  it('shows failed selected-state loading as a user-visible error', () => {
    expect(
      selectedClientView({
        defaultViewportDays: 30,
        selectedChatId: 'chat-a',
        selectedHistorySyncError: 'Procedure transport failed: fetch failed',
        selectedHistorySyncLoadingVisible: false,
        selectedHistorySyncState: null,
        selectedHistorySyncStatus: 'failed',
        viewportDays: 30
      })
    ).toEqual({
      message: 'Procedure transport failed: fetch failed',
      status: 'failed'
    });
  });

  it('keeps mutation errors visible without dropping the ready selected-state view', () => {
    expect(
      selectedClientView({
        defaultViewportDays: 30,
        selectedChatId: 'chat-a',
        selectedHistorySyncError: 'Procedure transport failed: fetch failed',
        selectedHistorySyncLoadingVisible: false,
        selectedHistorySyncState: selectedState,
        selectedHistorySyncStatus: 'ready',
        viewportDays: 30
      })
    ).toMatchObject({
      errorMessage: 'Procedure transport failed: fetch failed',
      status: 'ready'
    });
  });

  it('returns mutation errors only for the selected chat that started the mutation', () => {
    expect(
      selectedMutationErrorMessage({
        error: new Error('Procedure transport failed: fetch failed'),
        mutationChatId: 'chat-a',
        selectedChatId: 'chat-a'
      })
    ).toBe('Procedure transport failed: fetch failed');

    expect(
      selectedMutationErrorMessage({
        error: new Error('Procedure transport failed: fetch failed'),
        mutationChatId: 'chat-a',
        selectedChatId: 'chat-b'
      })
    ).toBeNull();
  });
});
