import type { Dataset } from '@agentg/data';
import type { JsonValue } from '@agentg/framework';

import type { RunStatus } from '../database/schema.js';

export type RunRecord = Readonly<{
  createdAt: Date;
  failureCode?: string | undefined;
  failureMessage?: string | undefined;
  inputDataset: Dataset;
  inputMetadata: JsonValue;
  nodeId: string;
  outputDataset?: Dataset | undefined;
  outputMetadata?: JsonValue | undefined;
  pipelineRunId: string;
  profile: string;
  prompt: string;
  runId: string;
  status: RunStatus;
  updatedAt: Date;
}>;
