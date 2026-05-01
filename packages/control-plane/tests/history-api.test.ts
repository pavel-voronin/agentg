import { describe, expect, it, vi } from 'vitest';

import { createHistoryApi } from '../src/control-plane/historyApi.js';

describe('createHistoryApi', () => {
  it('omits an empty chat search query for history.listChats', async () => {
    const rpc = vi.fn().mockResolvedValue({
      chats: [],
      navigation: {}
    });
    const api = createHistoryApi({ rpc });

    await api.listChats({
      folderId: null,
      listMode: 'main',
      query: ''
    });

    expect(rpc).toHaveBeenCalledWith('history.listChats', {
      limit: 500,
      list: 'main'
    });
  });

  it('sends a trimmed non-empty chat search query for history.listChats', async () => {
    const rpc = vi.fn().mockResolvedValue({
      chats: [],
      navigation: {}
    });
    const api = createHistoryApi({ rpc });

    await api.listChats({
      folderId: null,
      listMode: 'main',
      query: '  kolpaque  '
    });

    expect(rpc).toHaveBeenCalledWith('history.listChats', {
      limit: 500,
      query: 'kolpaque'
    });
  });
});
