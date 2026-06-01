import type { FileMediaKind } from './types.js';

export const MEDIA_MEGABYTE = 1024 * 1024;

export type MediaDownloadPolicyRule = {
  causes: readonly MediaDownloadPolicyCause[];
  maxBytes: number | null;
  mediaKind: FileMediaKind;
  name: string;
};

export type MediaDownloadPolicyCause =
  | 'explicit_request'
  | 'history_fetch'
  | 'initialization'
  | 'live_update'
  | 'operator_page';

export const automaticDownloadPolicyRules = [
  {
    causes: ['initialization', 'live_update'],
    maxBytes: null,
    mediaKind: 'avatar',
    name: 'chat avatars'
  },
  {
    causes: ['live_update', 'operator_page'],
    maxBytes: 1 * MEDIA_MEGABYTE,
    mediaKind: 'photo',
    name: 'photos up to 1 MB'
  },
  {
    causes: ['live_update', 'operator_page'],
    maxBytes: 1 * MEDIA_MEGABYTE,
    mediaKind: 'thumbnail',
    name: 'media thumbnails up to 1 MB'
  },
  {
    causes: ['live_update', 'operator_page'],
    maxBytes: 5 * MEDIA_MEGABYTE,
    mediaKind: 'video',
    name: 'videos up to 5 MB'
  },
  {
    causes: ['live_update', 'operator_page'],
    maxBytes: 5 * MEDIA_MEGABYTE,
    mediaKind: 'voice',
    name: 'voice messages up to 5 MB'
  }
] as const satisfies readonly MediaDownloadPolicyRule[];

export const explicitDownloadPolicyRules = [
  {
    causes: ['explicit_request'],
    maxBytes: 100 * MEDIA_MEGABYTE,
    mediaKind: 'photo',
    name: 'requested photos up to 100 MB'
  },
  {
    causes: ['explicit_request'],
    maxBytes: null,
    mediaKind: 'thumbnail',
    name: 'requested thumbnails'
  },
  {
    causes: ['explicit_request'],
    maxBytes: null,
    mediaKind: 'video',
    name: 'requested videos'
  },
  {
    causes: ['explicit_request'],
    maxBytes: null,
    mediaKind: 'document',
    name: 'requested documents'
  },
  {
    causes: ['explicit_request'],
    maxBytes: null,
    mediaKind: 'voice',
    name: 'requested voice messages'
  }
] as const satisfies readonly MediaDownloadPolicyRule[];
