import type { JsonValue } from '@agentg/framework';

import type { ContentRef, SourceRef } from '../schema.js';

export type ProcessingInput = Readonly<{
  artifactKey: string;
  contentRefs: readonly ContentRef[];
  instructions: string;
  payload: JsonValue;
  profile: string;
  sourceRefs: readonly SourceRef[];
}>;

export type ProcessingOutput = Readonly<{
  body: string;
  payload?: JsonValue | undefined;
  title?: string | undefined;
}>;

export type ProfileRunner = {
  hasProfile(profile: string): boolean;
  process(input: ProcessingInput): Promise<ProcessingOutput>;
};
