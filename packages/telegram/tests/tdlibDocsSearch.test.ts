import { describe, expect, it } from 'vitest';

import { searchTdlib } from '../src/tdlib-docs/schemaIndex.js';

describe('TDLib docs search', () => {
  it('keeps separated field matches below dense prefix matches', () => {
    expect(
      searchTdlib('chatfolderin')
        .slice(0, 2)
        .map((entry) => ({
          kind: entry.kind,
          label: entry.label
        }))
    ).toEqual([
      { kind: 'type', label: 'ChatFolderInfo' },
      { kind: 'constructor', label: 'chatFolderInfo' }
    ]);
  });

  it('ranks dense fuzzy label matches before separated field matches', () => {
    expect(
      searchTdlib('chatfolderinf')
        .slice(0, 3)
        .map((entry) => ({
          kind: entry.kind,
          label: entry.label
        }))
    ).toEqual([
      { kind: 'type', label: 'ChatFolderInfo' },
      { kind: 'constructor', label: 'chatFolderInfo' },
      { kind: 'field', label: 'chat_folder_info' }
    ]);
  });

  it('ranks full label matches before normalized field matches', () => {
    expect(
      searchTdlib('ChatFolderInfo')
        .slice(0, 3)
        .map((entry) => ({
          kind: entry.kind,
          label: entry.label
        }))
    ).toEqual([
      { kind: 'type', label: 'ChatFolderInfo' },
      { kind: 'constructor', label: 'chatFolderInfo' },
      { kind: 'field', label: 'chat_folder_info' }
    ]);
  });
});
