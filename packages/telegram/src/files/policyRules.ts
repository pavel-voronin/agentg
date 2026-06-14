import type { FileMediaKind } from './types.js';

export const MEDIA_MEGABYTE = 1024 * 1024;

export type MediaDownloadPolicyRule = {
  causes: readonly MediaDownloadPolicyCause[];
  maxBytes: number | null;
  mediaKind: FileMediaKind;
  name: string;
};

export const mediaDownloadPolicyCauses = [
  'explicit_request',
  'history_fetch',
  'initialization',
  'live_update',
  'operator_page'
] as const;

export type MediaDownloadPolicyCause = (typeof mediaDownloadPolicyCauses)[number];
