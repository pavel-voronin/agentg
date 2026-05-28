import type { EventBus } from '@agentg/events/bus';
import { defineDomain } from '@agentg/framework/domain';

import type { TelegramDatabase } from './database/client.js';
import { createTelegramControlPlane } from './control-plane/manifest.js';
import { chatDirectory } from './control-plane/backend/procedures/chatDirectory.js';
import { fileQueueStats } from './control-plane/backend/procedures/fileQueueStats.js';
import { message } from './control-plane/backend/procedures/message.js';
import { messagesPage } from './control-plane/backend/procedures/messagesPage.js';
import { requestFile } from './control-plane/backend/procedures/requestFile.js';
import type { TelegramFileSubsystem } from './files/subsystem.js';
import { countMessagesInIntervals } from './rpc/countMessagesInIntervals.js';
import { ensureHistoryCoverage } from './rpc/ensureHistoryCoverage.js';
import { fetchPage } from './rpc/fetchPage.js';
import { getChat } from './rpc/getChat.js';
import { getChatHistoryFacts } from './rpc/getChatHistoryFacts.js';
import { getHistoryCoverage } from './rpc/getHistoryCoverage.js';
import { listChats } from './rpc/listChats.js';
import { listRecentMessages } from './rpc/listRecentMessages.js';
import { searchMessages } from './rpc/searchMessages.js';
import { createTelegramTdlibOperations, type TelegramTdlibOperations } from './tdlib/operations.js';
import type { TdlibInvoker } from './tdlib/operationEvents.js';

const TELEGRAM_OPERATION_EVENT_TYPES = [
  'telegram.login.completed',
  'telegram.login.failed',
  'telegram.login.started'
] as const;

const TELEGRAM_DOMAIN_EVENT_TYPES = [
  'telegram.active_gift_auctions.updated',
  'telegram.active_notifications.updated',
  'telegram.animated_emoji_message.clicked',
  'telegram.application_recaptcha_verification.required',
  'telegram.application_verification.required',
  'telegram.attachment_menu_bots.updated',
  'telegram.autosave_settings.updated',
  'telegram.business_connection.updated',
  'telegram.business_callback_query.received',
  'telegram.business_message.deleted',
  'telegram.call.updated',
  'telegram.call.signaling_data.received',
  'telegram.chat.online_member_count.updated',
  'telegram.chat_join_request.created',
  'telegram.callback_query.received',
  'telegram.chosen_inline_result.received',
  'telegram.chat.removed',
  'telegram.chat.updated',
  'telegram.chat_member.updated',
  'telegram.connection_state_connecting',
  'telegram.connection_state_connecting_to_proxy',
  'telegram.connection_state_ready',
  'telegram.connection_state_updating',
  'telegram.connection_state_waiting_for_network',
  'telegram.custom_event.received',
  'telegram.custom_query.received',
  'telegram.chat_action_cancel',
  'telegram.chat_action_choosing_contact',
  'telegram.chat_action_choosing_location',
  'telegram.chat_action_choosing_sticker',
  'telegram.chat_action_recording_video',
  'telegram.chat_action_recording_video_note',
  'telegram.chat_action_recording_voice_note',
  'telegram.chat_action_start_playing_game',
  'telegram.chat_action_typing',
  'telegram.chat_action_uploading_document',
  'telegram.chat_action_uploading_photo',
  'telegram.chat_action_uploading_video',
  'telegram.chat_action_uploading_video_note',
  'telegram.chat_action_uploading_voice_note',
  'telegram.chat_action_watching_animations',
  'telegram.chat_folders.updated',
  'telegram.default_background.updated',
  'telegram.direct_messages_chat_topic.updated',
  'telegram.emoji_chat_themes.updated',
  'telegram.file_download.removed',
  'telegram.file_download.updated',
  'telegram.file_downloads.updated',
  'telegram.file_speed_limit_notification.received',
  'telegram.files.queue.updated',
  'telegram.forum_topic_info.updated',
  'telegram.forum_topic.updated',
  'telegram.freeze_state.updated',
  'telegram.gift_auction_state.updated',
  'telegram.group_call.updated',
  'telegram.group_call_encrypted_participant_users.updated',
  'telegram.group_call_message.created',
  'telegram.group_call_message.send_failed',
  'telegram.group_call_paid_reaction.received',
  'telegram.group_call_participant.updated-or-removed',
  'telegram.group_call_messages.deleted',
  'telegram.group_call_verification_state.updated',
  'telegram.guest_query.received',
  'telegram.history.coverage.changed',
  'telegram.inline_callback_query.received',
  'telegram.inline_query.received',
  'telegram.live_story_top_donors.updated',
  'telegram.managed_bot.updated',
  'telegram.message.created',
  'telegram.message.deleted',
  'telegram.message.send_failed',
  'telegram.message.send_succeeded',
  'telegram.message.updated',
  'telegram.oauth_request.received',
  'telegram.notification_settings.updated',
  'telegram.paid_media.purchased',
  'telegram.pending_notifications.updated',
  'telegram.pending_text_message.updated',
  'telegram.poll.updated',
  'telegram.poll_answer.updated',
  'telegram.pre_checkout_query.received',
  'telegram.quick_reply_shortcut.deleted',
  'telegram.quick_reply_shortcut.messages.updated',
  'telegram.quick_reply_shortcut.updated',
  'telegram.saved_messages_tags.updated',
  'telegram.saved_messages_topic.updated',
  'telegram.service_notification.received',
  'telegram.shipping_query.received',
  'telegram.stake_dice_state.updated',
  'telegram.status',
  'telegram.story.deleted',
  'telegram.story.post_failed',
  'telegram.story.post_succeeded',
  'telegram.story.updated',
  'telegram.story_stealth_mode.updated',
  'telegram.suggested_actions.updated',
  'telegram.supergroup.updated',
  'telegram.terms_of_service.required',
  'telegram.ton_revenue_status.updated',
  'telegram.unconfirmed_session.updated',
  'telegram.unread_chat_count.updated',
  'telegram.unread_message_count.updated',
  'telegram.user.status.updated',
  'telegram.user.updated',
  'telegram.user_full_info.updated',
  'telegram.user_privacy_setting_rules.updated',
  'telegram.web_app.close_requested'
] as const;

const TELEGRAM_TDLIB_METHODS = [
  'addFileToDownloads',
  'close',
  'deleteFile',
  'downloadFile',
  'getChat',
  'getChatHistory',
  'getChatMessageByDate',
  'getChats',
  'getFile',
  'getMe',
  'loadChats',
  'removeFileFromDownloads'
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

export type TelegramRpcRuntimeDeps = {
  client: TdlibInvoker;
  database: TelegramDatabase;
  eventBus: EventBus;
  files: TelegramFileSubsystem;
};

export type TelegramRpcRuntime = TelegramRpcRuntimeDeps & {
  tdlib: TelegramTdlibOperations;
};

export const telegramDomain = defineDomain({
  controlPlane: ({ assetVersion, assetVersions }) =>
    createTelegramControlPlane(assetVersion, assetVersions),
  createRuntime: createTelegramRpcRuntime,
  events: TELEGRAM_EVENT_TYPES,
  procedures: {
    'cp.chatDirectory': chatDirectory,
    'cp.fileQueueStats': fileQueueStats,
    'cp.message': message,
    'cp.messagesPage': messagesPage,
    'cp.requestFile': requestFile,
    countMessagesInIntervals,
    ensureHistoryCoverage,
    fetchPage,
    getChat,
    getChatHistoryFacts,
    getHistoryCoverage,
    listChats,
    listRecentMessages,
    searchMessages
  },
  required: true,
  slug: 'telegram'
});

export const createTelegramRpcClient = telegramDomain.createRpcClient;
export type TelegramRpcClient = ReturnType<typeof createTelegramRpcClient>;
export const createTelegramServiceManifest = (
  config: Parameters<typeof telegramDomain.createServiceManifest>[0]
) => telegramDomain.createServiceManifest(config);
export type TelegramRouter = ReturnType<typeof telegramDomain.createRpcRouter>;

function createTelegramRpcRuntime(deps: TelegramRpcRuntimeDeps): TelegramRpcRuntime {
  return {
    ...deps,
    tdlib: createTelegramTdlibOperations({
      client: deps.client,
      eventBus: deps.eventBus
    })
  };
}
