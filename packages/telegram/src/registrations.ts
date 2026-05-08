import { telegramRpcSurface } from './rpc/surface.js';
import { telegramControlPlane } from './control-plane/manifest.js';

const TELEGRAM_OPERATION_EVENT_TYPES = [
  'telegram.login.completed',
  'telegram.login.failed',
  'telegram.login.started'
] as const;

const TELEGRAM_DOMAIN_EVENT_TYPES = [
  'telegram.chat.removed',
  'telegram.chat.updated',
  'telegram.chat_folders.updated',
  'telegram.message.created',
  'telegram.message.deleted',
  'telegram.message.updated',
  'telegram.status',
  'telegram.user.updated'
] as const;

const TELEGRAM_TDLIB_METHODS = [
  'close',
  'getChat',
  'getChatHistory',
  'getChatMessageByDate',
  'getChats',
  'getMe',
  'loadChats'
] as const;

const TELEGRAM_OPERATION_LIFECYCLES = ['completed', 'failed', 'started'] as const;

export const TELEGRAM_TDLIB_EVENT_TYPES = TELEGRAM_TDLIB_METHODS.flatMap((method) =>
  TELEGRAM_OPERATION_LIFECYCLES.map((lifecycle) => `telegram.tdlib.${method}.${lifecycle}`)
);

export const TELEGRAM_EVENT_TYPES = [
  ...TELEGRAM_DOMAIN_EVENT_TYPES,
  ...TELEGRAM_OPERATION_EVENT_TYPES,
  ...TELEGRAM_TDLIB_EVENT_TYPES
].sort();

export function createTelegramServiceManifest(config: { rpcUrl: string }) {
  return {
    controlPlane: telegramControlPlane,
    events: TELEGRAM_EVENT_TYPES,
    extensions: [],
    procedures: telegramRpcSurface.procedures(),
    required: true,
    rpcUrl: config.rpcUrl,
    slug: 'telegram'
  };
}
