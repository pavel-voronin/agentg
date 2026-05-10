import { describe, expect, it } from 'vitest';

import { selectedWorkspaceView } from '../src/control-plane/selectedWorkspaceView.js';

const loadingSource = {
  defaultViewportDays: 30,
  selectedChatId: 'chat-1',
  selectedHistorySyncState: null,
  selectedHistorySyncStatus: 'loading' as const,
  viewportDays: 30
};

describe('selected workspace view', () => {
  it('keeps fast selected chat loads in a quiet pending state', () => {
    expect(
      selectedWorkspaceView({
        ...loadingSource,
        selectedHistorySyncLoadingVisible: false
      })
    ).toEqual({ status: 'pending' });
  });

  it('shows selected chat loading feedback after the delay threshold', () => {
    expect(
      selectedWorkspaceView({
        ...loadingSource,
        selectedHistorySyncLoadingVisible: true
      })
    ).toEqual({ status: 'loading' });
  });
});
