import type { RunStatus } from '../database/schema.js';
import type { LlmRunPayload, TriggerProvenance } from '../schema.js';
import type { SourceSnapshot } from '../sources/types.js';

export type RunRecord = Readonly<{
  artifactKey: string;
  createdAt: Date;
  deduplicationKey?: string | undefined;
  failureCode?: string | undefined;
  failureMessage?: string | undefined;
  payload: LlmRunPayload;
  profile: string;
  runId: string;
  sourceSnapshot?: SourceSnapshot | undefined;
  status: RunStatus;
  trigger?: TriggerProvenance | undefined;
  updatedAt: Date;
}>;
