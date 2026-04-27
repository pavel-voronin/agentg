import { describe, it } from 'vitest';

describe('history sync acceptance', () => {
  it.todo(
    'materializes a target for a newly discovered matching chat and reconciles it into a job'
  );
  it.todo('completes a job and then reconciles the target to no remaining jobs');
  it.todo(
    'updates a linked target after a template change and reconciles the new missing interval'
  );
  it.todo('keeps a standalone target unchanged after a template change');
  it.todo('covers a rolling recent target with historical jobs up to the live-covered tail');
});
