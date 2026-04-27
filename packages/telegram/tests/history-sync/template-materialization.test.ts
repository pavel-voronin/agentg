import { describe, it } from 'vitest';

describe('history template materialization', () => {
  it.todo('creates a linked target when a discovered chat matches a template');
  it.todo('does not create a target when a discovered chat does not match any template');
  it.todo('materializes the template range into the target range');
  it.todo('updates linked targets when the source template range changes');
  it.todo('does not update standalone targets when the source template range changes');
  it.todo('removes the template link when a linked target is edited directly');
  it.todo('does not create duplicate targets for the same chat and range');
  it.todo('allows multiple targets for the same chat when their ranges differ');
});
