import { describe, it } from 'vitest';

describe('history coverage', () => {
  it.todo('creates the first coverage interval for a chat');
  it.todo('keeps separated intervals separate');
  it.todo('merges overlapping intervals for the same chat');
  it.todo('merges touching intervals for the same chat');
  it.todo('bridges two existing intervals when new coverage fills the gap');
  it.todo('does not merge intervals from different chats');
  it.todo('stores coverage without source or provenance');
  it.todo('extends coverage from accepted live message-history updates');
  it.todo('does not extend coverage from non-message live updates');
});
