import { describe, it } from 'vitest';

describe('history reconciler', () => {
  it.todo('creates one job when an absolute target has no coverage');
  it.todo('creates no jobs when an absolute target is fully covered');
  it.todo('creates a prefix job when coverage starts after the target start');
  it.todo('creates a suffix job when coverage ends before the target end');
  it.todo('creates a middle-gap job when coverage has a hole inside the target');
  it.todo('creates multiple jobs for multiple missing intervals');
  it.todo('uses the union of multiple targets for the same chat as desired coverage');
  it.todo('subtracts all coverage intervals for the chat from desired coverage');
  it.todo('projects an absolute target to the same desired interval every time');
  it.todo('projects a relative target using the provided current time');
  it.todo('does not create jobs for the live-covered tail of a relative target');
  it.todo('splits a large missing interval into executable job windows');
  it.todo('orders runnable jobs by missing intervals closest to the present first');
});
