import type { JsonValue } from '@agentg/framework';

import type { ContentRef, SourceRef } from '../schema.js';

export type ArtifactRecord = Readonly<{
  artifactId: string;
  artifactKey: string;
  body: string;
  contentRefs: readonly ContentRef[];
  createdAt: Date;
  payload?: JsonValue | undefined;
  profile: string;
  runId: string;
  sourceRef: SourceRef;
  sourceRefs: readonly SourceRef[];
  status: 'current';
  title?: string | undefined;
  updatedAt: Date;
}>;

export type ArtifactView = Readonly<{
  artifactId: string;
  artifactKey: string;
  body: string;
  contentRefs: readonly ContentRef[];
  createdAt: string;
  payload?: JsonValue | undefined;
  profile: string;
  runId: string;
  sourceRef: SourceRef;
  sourceRefs: readonly SourceRef[];
  status: 'current';
  title?: string | undefined;
  updatedAt: string;
}>;

export function artifactView(record: ArtifactRecord): ArtifactView {
  return {
    artifactId: record.artifactId,
    artifactKey: record.artifactKey,
    body: record.body,
    contentRefs: record.contentRefs,
    createdAt: record.createdAt.toISOString(),
    ...(record.payload === undefined ? {} : { payload: record.payload }),
    profile: record.profile,
    runId: record.runId,
    sourceRef: record.sourceRef,
    sourceRefs: record.sourceRefs,
    status: record.status,
    ...(record.title === undefined ? {} : { title: record.title }),
    updatedAt: record.updatedAt.toISOString()
  };
}
