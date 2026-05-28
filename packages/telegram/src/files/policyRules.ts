import type { TelegramFileMediaKind } from './types.js';

export const TELEGRAM_MEDIA_MEGABYTE = 1024 * 1024;

export type TelegramMediaDownloadPolicyRule = {
  causes: readonly TelegramMediaDownloadPolicyCause[];
  maxBytes: number | null;
  mediaKind: TelegramFileMediaKind;
  name: string;
};

export type TelegramMediaDownloadPolicyCause =
  | 'explicit_request'
  | 'history_fetch'
  | 'initialization'
  | 'live_update'
  | 'operator_page';

export const telegramAutomaticDownloadPolicyRules = [
  {
    causes: ['initialization', 'live_update'],
    maxBytes: null,
    mediaKind: 'avatar',
    name: 'chat avatars'
  },
  {
    causes: ['live_update', 'operator_page'],
    maxBytes: 1 * TELEGRAM_MEDIA_MEGABYTE,
    mediaKind: 'photo',
    name: 'photos up to 1 MB'
  },
  {
    causes: ['live_update', 'operator_page'],
    maxBytes: 1 * TELEGRAM_MEDIA_MEGABYTE,
    mediaKind: 'thumbnail',
    name: 'media thumbnails up to 1 MB'
  },
  {
    causes: ['live_update', 'operator_page'],
    maxBytes: 5 * TELEGRAM_MEDIA_MEGABYTE,
    mediaKind: 'video',
    name: 'videos up to 5 MB'
  },
  {
    causes: ['live_update', 'operator_page'],
    maxBytes: 5 * TELEGRAM_MEDIA_MEGABYTE,
    mediaKind: 'voice',
    name: 'voice messages up to 5 MB'
  }
] as const satisfies readonly TelegramMediaDownloadPolicyRule[];

export const telegramExplicitDownloadPolicyRules = [
  {
    causes: ['explicit_request'],
    maxBytes: 100 * TELEGRAM_MEDIA_MEGABYTE,
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
] as const satisfies readonly TelegramMediaDownloadPolicyRule[];
