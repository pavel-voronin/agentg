import { createIntegrationEvent } from '@agentg/events/envelope';
import { createValidatedEventBus } from '@agentg/events/validated-bus';
import { createModuleServiceManifest } from '@agentg/framework';
import { describe, expect, it } from 'vitest';

import { telegramModule, TELEGRAM_EVENT_TYPES } from '../src/module.js';

describe('Telegram service manifest', () => {
  it('lists exact Telegram events without wildcard types', () => {
    const manifest = createModuleServiceManifest(telegramModule, {
      controlPlaneAssetVersion: 'asset-v1',
      controlPlaneAssetVersions: {
        'workspace.js': 'workspace-v1'
      },
      rpcUrl: 'http://telegram.local'
    });
    const controlPlane = manifest.controlPlane;

    expect(controlPlane).toBeDefined();
    expect(controlPlane?.assetVersion).toBe('asset-v1');
    expect(controlPlane?.assetVersions).toEqual({
      'workspace.js': 'workspace-v1'
    });
    expect(manifest.events).toEqual(TELEGRAM_EVENT_TYPES);
    expect(manifest.events).not.toContain('telegram.tdlib.*');
    expect(manifest.events.some((type) => type.includes('*'))).toBe(false);
    expect(manifest.events).toEqual([
      'telegram.active_gift_auctions.updated',
      'telegram.active_notifications.updated',
      'telegram.animated_emoji_message.clicked',
      'telegram.application_recaptcha_verification.required',
      'telegram.application_verification.required',
      'telegram.attachment_menu_bots.updated',
      'telegram.autosave_settings.updated',
      'telegram.business_callback_query.received',
      'telegram.business_connection.updated',
      'telegram.business_message.deleted',
      'telegram.call.signaling_data.received',
      'telegram.call.updated',
      'telegram.callback_query.received',
      'telegram.chat.online_member_count.updated',
      'telegram.chat.removed',
      'telegram.chat.updated',
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
      'telegram.chat_join_request.created',
      'telegram.chat_member.updated',
      'telegram.chosen_inline_result.received',
      'telegram.connection_state_connecting',
      'telegram.connection_state_connecting_to_proxy',
      'telegram.connection_state_ready',
      'telegram.connection_state_updating',
      'telegram.connection_state_waiting_for_network',
      'telegram.custom_event.received',
      'telegram.custom_query.received',
      'telegram.default_background.updated',
      'telegram.direct_messages_chat_topic.updated',
      'telegram.emoji_chat_themes.updated',
      'telegram.file_download.removed',
      'telegram.file_download.updated',
      'telegram.file_downloads.updated',
      'telegram.file_speed_limit_notification.received',
      'telegram.files.queue.updated',
      'telegram.forum_topic.updated',
      'telegram.forum_topic_info.updated',
      'telegram.freeze_state.updated',
      'telegram.gift_auction_state.updated',
      'telegram.group_call.updated',
      'telegram.group_call_encrypted_participant_users.updated',
      'telegram.group_call_message.created',
      'telegram.group_call_message.send_failed',
      'telegram.group_call_messages.deleted',
      'telegram.group_call_paid_reaction.received',
      'telegram.group_call_participant.updated-or-removed',
      'telegram.group_call_verification_state.updated',
      'telegram.guest_query.received',
      'telegram.history.coverage.changed',
      'telegram.inline_callback_query.received',
      'telegram.inline_query.received',
      'telegram.live_story_top_donors.updated',
      'telegram.login.completed',
      'telegram.login.failed',
      'telegram.login.started',
      'telegram.managed_bot.updated',
      'telegram.message.created',
      'telegram.message.deleted',
      'telegram.message.send_failed',
      'telegram.message.send_succeeded',
      'telegram.message.updated',
      'telegram.notification_settings.updated',
      'telegram.oauth_request.received',
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
      'telegram.tdlib.addFileToDownloads.completed',
      'telegram.tdlib.addFileToDownloads.failed',
      'telegram.tdlib.addFileToDownloads.started',
      'telegram.tdlib.close.completed',
      'telegram.tdlib.close.failed',
      'telegram.tdlib.close.started',
      'telegram.tdlib.deleteFile.completed',
      'telegram.tdlib.deleteFile.failed',
      'telegram.tdlib.deleteFile.started',
      'telegram.tdlib.downloadFile.completed',
      'telegram.tdlib.downloadFile.failed',
      'telegram.tdlib.downloadFile.started',
      'telegram.tdlib.getChat.completed',
      'telegram.tdlib.getChat.failed',
      'telegram.tdlib.getChat.started',
      'telegram.tdlib.getChatHistory.completed',
      'telegram.tdlib.getChatHistory.failed',
      'telegram.tdlib.getChatHistory.started',
      'telegram.tdlib.getChatMessageByDate.completed',
      'telegram.tdlib.getChatMessageByDate.failed',
      'telegram.tdlib.getChatMessageByDate.started',
      'telegram.tdlib.getChats.completed',
      'telegram.tdlib.getChats.failed',
      'telegram.tdlib.getChats.started',
      'telegram.tdlib.getFile.completed',
      'telegram.tdlib.getFile.failed',
      'telegram.tdlib.getFile.started',
      'telegram.tdlib.getMe.completed',
      'telegram.tdlib.getMe.failed',
      'telegram.tdlib.getMe.started',
      'telegram.tdlib.loadChats.completed',
      'telegram.tdlib.loadChats.failed',
      'telegram.tdlib.loadChats.started',
      'telegram.tdlib.removeFileFromDownloads.completed',
      'telegram.tdlib.removeFileFromDownloads.failed',
      'telegram.tdlib.removeFileFromDownloads.started',
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
    ]);
  });

  it('lists every lifecycle for every TDLib operation used by Telegram code', () => {
    expect(TELEGRAM_EVENT_TYPES.filter((event) => event.startsWith('telegram.tdlib.'))).toEqual([
      'telegram.tdlib.addFileToDownloads.completed',
      'telegram.tdlib.addFileToDownloads.failed',
      'telegram.tdlib.addFileToDownloads.started',
      'telegram.tdlib.close.completed',
      'telegram.tdlib.close.failed',
      'telegram.tdlib.close.started',
      'telegram.tdlib.deleteFile.completed',
      'telegram.tdlib.deleteFile.failed',
      'telegram.tdlib.deleteFile.started',
      'telegram.tdlib.downloadFile.completed',
      'telegram.tdlib.downloadFile.failed',
      'telegram.tdlib.downloadFile.started',
      'telegram.tdlib.getChat.completed',
      'telegram.tdlib.getChat.failed',
      'telegram.tdlib.getChat.started',
      'telegram.tdlib.getChatHistory.completed',
      'telegram.tdlib.getChatHistory.failed',
      'telegram.tdlib.getChatHistory.started',
      'telegram.tdlib.getChatMessageByDate.completed',
      'telegram.tdlib.getChatMessageByDate.failed',
      'telegram.tdlib.getChatMessageByDate.started',
      'telegram.tdlib.getChats.completed',
      'telegram.tdlib.getChats.failed',
      'telegram.tdlib.getChats.started',
      'telegram.tdlib.getFile.completed',
      'telegram.tdlib.getFile.failed',
      'telegram.tdlib.getFile.started',
      'telegram.tdlib.getMe.completed',
      'telegram.tdlib.getMe.failed',
      'telegram.tdlib.getMe.started',
      'telegram.tdlib.loadChats.completed',
      'telegram.tdlib.loadChats.failed',
      'telegram.tdlib.loadChats.started',
      'telegram.tdlib.removeFileFromDownloads.completed',
      'telegram.tdlib.removeFileFromDownloads.failed',
      'telegram.tdlib.removeFileFromDownloads.started'
    ]);
  });
});

describe('validated event bus', () => {
  it('throws when a publisher emits an event type outside its manifest whitelist', () => {
    const published: string[] = [];
    const eventBus = createValidatedEventBus(
      {
        close: () => Promise.resolve(),
        publish(event) {
          published.push(event.type);
        },
        subscribe() {
          return {
            unsubscribe() {
              return;
            }
          };
        }
      },
      {
        allowedTypes: ['telegram.status'],
        publisher: 'telegram'
      }
    );

    eventBus.publish(
      createIntegrationEvent({
        data: {},
        type: 'telegram.status'
      })
    );

    expect(() =>
      eventBus.publish(
        createIntegrationEvent({
          data: {},
          type: 'telegram.unknown'
        })
      )
    ).toThrow('Unregistered integration event type for telegram: telegram.unknown');
    expect(published).toEqual(['telegram.status']);
  });
});
