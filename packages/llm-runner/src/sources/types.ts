import type { JsonValue } from '@agentg/framework';

import type { ContentRef, SourceRef, SourceSelector } from '../schema.js';

export type SourceSnapshot = Readonly<{
  contentRefs: readonly ContentRef[];
  payload: JsonValue;
  sourceRefs: readonly SourceRef[];
}>;

export type SourceResolution =
  | Readonly<{
      snapshot: SourceSnapshot;
      status: 'ready';
    }>
  | Readonly<{
      contentRefs?: readonly ContentRef[] | undefined;
      requestId: string;
      sourceRefs?: readonly SourceRef[] | undefined;
      status: 'pending';
    }>
  | Readonly<{
      error: {
        code: string;
        message: string;
      };
      status: 'rejected';
    }>;

export type SourceResolver = {
  resolve(input: { sourceSelector: SourceSelector }): Promise<SourceResolution>;
};
