import type { EventBus } from '@agentg/framework';

import { publishMessageCreated, publishMessageDeleted, publishMessageUpdated } from '../events.js';
import type { DomainChange } from '../domain/changes.js';
import type { Repositories } from '../repositories/repositories.js';
import { applyMessageReactionUpdate } from './messageReaction.js';

export type ApplyChangeResult = {
  applied: boolean;
  change: DomainChange;
};

export async function applyDomainChanges(input: {
  changes: readonly DomainChange[];
  events: EventBus;
  repositories: Repositories;
}): Promise<ApplyChangeResult[]> {
  const results: ApplyChangeResult[] = [];
  for (const change of input.changes) {
    switch (change.kind) {
      case 'activeNotificationSnapshot.replaced': {
        await input.repositories.transaction(async (repositories) => {
          for (const message of change.snapshot.messages) {
            await repositories.messages.save(message);
          }
          await repositories.activeNotifications.replaceSnapshot(change.snapshot);
        });
        results.push({ applied: true, change });
        break;
      }

      case 'activeNotification.upserted': {
        await input.repositories.transaction(async (repositories) => {
          for (const message of change.messages) {
            await repositories.messages.save(message);
          }
          await repositories.activeNotifications.upsert(change.notification);
        });
        results.push({ applied: true, change });
        break;
      }

      case 'activeLiveLocationMessages.replaced': {
        await input.repositories.messages.replaceActiveLiveLocationMessages(change.messages);
        results.push({ applied: true, change });
        break;
      }

      case 'attachmentMenuBots.replaced': {
        await input.repositories.attachmentMenuBots.replace(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'activeNotificationGroup.updated': {
        await input.repositories.transaction(async (repositories) => {
          for (const message of change.update.addedMessages) {
            await repositories.messages.save(message);
          }
          await repositories.activeNotifications.applyGroupUpdate(change.update);
        });
        results.push({ applied: true, change });
        break;
      }

      case 'businessMessage.created': {
        const result = await input.repositories.transaction(async (repositories) => {
          const messageInserted = await repositories.messages.save(change.message, {
            conflict: 'ignore'
          });
          if (!messageInserted) {
            await repositories.messages.save(change.message);
          }
          if (change.replyToMessage !== null) {
            await repositories.messages.save(change.replyToMessage);
          }
          const businessMessageInserted = await repositories.businessMessages.saveNew(
            change.businessMessage
          );
          return {
            businessMessageInserted,
            messageInserted
          };
        });
        const applied = result.businessMessageInserted || result.messageInserted;
        if (applied) {
          publishMessageCreated(input.events, change.payload);
        }
        results.push({ applied, change });
        break;
      }

      case 'businessMessage.updated': {
        await input.repositories.transaction(async (repositories) => {
          await repositories.messages.save(change.message);
          if (change.replyToMessage !== null) {
            await repositories.messages.save(change.replyToMessage);
          }
          await repositories.businessMessages.save(change.businessMessage);
        });
        publishMessageUpdated(input.events, change.payload);
        results.push({ applied: true, change });
        break;
      }

      case 'businessMessage.saved': {
        await input.repositories.transaction(async (repositories) => {
          await repositories.messages.save(change.message);
          if (change.replyToMessage !== null) {
            await repositories.messages.save(change.replyToMessage);
          }
          await repositories.businessMessages.save(change.businessMessage);
        });
        results.push({ applied: true, change });
        break;
      }

      case 'businessMessages.deleted': {
        await input.repositories.businessMessages.delete(change.businessMessages);
        results.push({ applied: true, change });
        break;
      }

      case 'businessConnection.saved': {
        await input.repositories.businessConnections.save(change.connection);
        results.push({ applied: true, change });
        break;
      }

      case 'call.saved': {
        await input.repositories.calls.save(change.call);
        results.push({ applied: true, change });
        break;
      }

      case 'secretChat.saved': {
        await input.repositories.secretChats.save(change.chat);
        results.push({ applied: true, change });
        break;
      }

      case 'kvEntry.saved': {
        await input.repositories.kv.save(change.entry);
        results.push({ applied: true, change });
        break;
      }

      case 'kvEntry.deleted': {
        await input.repositories.kv.delete(change.key);
        results.push({ applied: true, change });
        break;
      }

      case 'fileDownload.saved': {
        await input.repositories.fileDownloads.save(change.download);
        results.push({ applied: true, change });
        break;
      }

      case 'fileDownload.updated': {
        const applied = await input.repositories.fileDownloads.patch(change.patch);
        results.push({ applied, change });
        break;
      }

      case 'fileDownload.deleted': {
        await input.repositories.fileDownloads.delete(change.fileId);
        results.push({ applied: true, change });
        break;
      }

      case 'notificationSettings.saved': {
        await input.repositories.settings.saveNotificationSettings(change.settings);
        results.push({ applied: true, change });
        break;
      }

      case 'autosaveSettings.saved': {
        await input.repositories.settings.saveAutosaveSettings(change.settings);
        results.push({ applied: true, change });
        break;
      }

      case 'autosaveSettings.deleted': {
        await input.repositories.settings.deleteAutosaveSettings(change.scopeKey);
        results.push({ applied: true, change });
        break;
      }

      case 'userPrivacySettingRules.saved': {
        await input.repositories.settings.saveUserPrivacySettingRules(change.rules);
        results.push({ applied: true, change });
        break;
      }

      case 'termsOfService.replaced': {
        await input.repositories.settings.replaceTermsOfService(change.terms);
        results.push({ applied: true, change });
        break;
      }

      case 'contactCloseBirthdays.replaced': {
        await input.repositories.state.replaceContactCloseBirthdays(change.records);
        results.push({ applied: true, change });
        break;
      }

      case 'textCompositionStyles.replaced': {
        await input.repositories.state.replaceTextCompositionStyles(change.records);
        results.push({ applied: true, change });
        break;
      }

      case 'chatRevenueAmount.saved': {
        await input.repositories.state.saveChatRevenueAmount(change.record);
        results.push({ applied: true, change });
        break;
      }

      case 'fileGenerationRequest.saved': {
        await input.repositories.state.saveFileGenerationRequest(change.record);
        results.push({ applied: true, change });
        break;
      }

      case 'fileGenerationRequest.deleted': {
        await input.repositories.state.deleteFileGenerationRequest(change.generationId);
        results.push({ applied: true, change });
        break;
      }

      case 'forumTopic.saved': {
        await input.repositories.runtimeState.saveForumTopic(change.topic);
        results.push({ applied: true, change });
        break;
      }

      case 'forumTopicInfo.saved': {
        await input.repositories.runtimeState.saveForumTopicInfo(change.info);
        results.push({ applied: true, change });
        break;
      }

      case 'groupCall.saved': {
        await input.repositories.runtimeState.saveGroupCall(change.groupCall);
        results.push({ applied: true, change });
        break;
      }

      case 'groupCallMessage.saved': {
        await input.repositories.runtimeState.saveGroupCallMessage(change.message);
        results.push({ applied: true, change });
        break;
      }

      case 'groupCallMessage.errorPatched': {
        await input.repositories.runtimeState.patchGroupCallMessageError(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'groupCallMessages.deleted': {
        await input.repositories.runtimeState.deleteGroupCallMessages(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'groupCallParticipant.saved': {
        await input.repositories.runtimeState.saveGroupCallParticipant(change.participant);
        results.push({ applied: true, change });
        break;
      }

      case 'groupCallParticipant.deleted': {
        await input.repositories.runtimeState.deleteGroupCallParticipant(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'groupCallEncryptedParticipantUsers.saved': {
        await input.repositories.runtimeState.saveGroupCallEncryptedParticipantUsers(change.record);
        results.push({ applied: true, change });
        break;
      }

      case 'groupCallVerificationState.saved': {
        await input.repositories.runtimeState.saveGroupCallVerificationState(change.state);
        results.push({ applied: true, change });
        break;
      }

      case 'languagePackStrings.replaced': {
        await input.repositories.runtimeState.replaceLanguagePackStrings(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'liveStoryDonors.saved': {
        await input.repositories.runtimeState.saveLiveStoryDonors(change.donors);
        results.push({ applied: true, change });
        break;
      }

      case 'managedBot.saved': {
        await input.repositories.runtimeState.saveManagedBot(change.bot);
        results.push({ applied: true, change });
        break;
      }

      case 'defaultBackgroundSelection.saved': {
        await input.repositories.transaction(async (repositories) => {
          if (change.input.background === null) {
            await repositories.kv.delete(change.input.key);
            return;
          }
          await repositories.backgrounds.save({
            backgrounds: [change.input.background],
            files: change.input.files
          });
          await repositories.kv.save({
            key: change.input.key,
            value: change.input.value
          });
        });
        results.push({ applied: true, change });
        break;
      }

      case 'emojiChatThemes.saved': {
        await input.repositories.transaction(async (repositories) => {
          await repositories.backgrounds.save({
            backgrounds: change.input.backgrounds,
            files: change.input.files
          });
          await repositories.kv.save(change.input.entry);
        });
        results.push({ applied: true, change });
        break;
      }

      case 'chatBoost.saved': {
        await input.repositories.state.saveChatBoost(change.record);
        results.push({ applied: true, change });
        break;
      }

      case 'chatActiveStories.saved': {
        await input.repositories.state.saveChatActiveStories(change.record);
        results.push({ applied: true, change });
        break;
      }

      case 'story.saved': {
        await input.repositories.stories.save(change.story);
        results.push({ applied: true, change });
        break;
      }

      case 'story.deleted': {
        await input.repositories.stories.delete(change.story);
        results.push({ applied: true, change });
        break;
      }

      case 'savedMessagesTopic.saved': {
        await input.repositories.topics.saveSavedMessagesTopic(change.topic);
        results.push({ applied: true, change });
        break;
      }

      case 'savedMessagesTags.replaced': {
        await input.repositories.topics.replaceSavedMessagesTags(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'directMessagesChatTopic.saved': {
        await input.repositories.topics.saveDirectMessagesChatTopic(change.topic);
        results.push({ applied: true, change });
        break;
      }

      case 'poll.replaced': {
        await input.repositories.polls.replacePoll(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'pollAnswerOptions.replaced': {
        await input.repositories.polls.replacePollAnswerOptions(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'quickReplyShortcut.saved': {
        await input.repositories.quickReplies.saveShortcut(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'quickReplyShortcut.deleted': {
        await input.repositories.quickReplies.deleteShortcut(change.shortcutId);
        results.push({ applied: true, change });
        break;
      }

      case 'quickReplyMessages.replaced': {
        await input.repositories.quickReplies.replaceMessages(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'chatFolders.replaced': {
        await input.repositories.chatFolders.replace(change.folders);
        results.push({ applied: true, change });
        break;
      }

      case 'chatListMembership.added': {
        await input.repositories.chats.addListMembership(change.membership);
        results.push({ applied: true, change });
        break;
      }

      case 'chatListMembership.removed': {
        await input.repositories.chats.removeListMembership(change.membership);
        results.push({ applied: true, change });
        break;
      }

      case 'chatMember.saved': {
        await input.repositories.chatMembers.saveMember(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'chatJoinRequest.saved': {
        await input.repositories.chatMembers.saveJoinRequest(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'suggestedActionsDelta.applied': {
        await input.repositories.suggestedActions.applyDelta(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'starRevenueStatus.saved': {
        await input.repositories.starRevenue.save(change.status);
        results.push({ applied: true, change });
        break;
      }

      case 'stickerSet.saved': {
        await input.repositories.stickers.saveSet(change.stickerSet);
        results.push({ applied: true, change });
        break;
      }

      case 'sticker.saved': {
        await input.repositories.stickers.save(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'giftAuctionStates.saved': {
        await input.repositories.gifts.saveAuctionStates(change.input);
        results.push({ applied: true, change });
        break;
      }

      case 'chat.saved': {
        await input.repositories.chats.save(change.chat, change.positions);
        results.push({ applied: true, change });
        break;
      }

      case 'chatPhotoInfo.saved': {
        await input.repositories.transaction(async (repositories) => {
          await repositories.files.saveMany(change.input.files);
          await repositories.chats.upsert(change.input.chat);
        });
        results.push({ applied: true, change });
        break;
      }

      case 'chatBackground.saved': {
        await input.repositories.transaction(async (repositories) => {
          if (change.input.background !== null) {
            await repositories.backgrounds.save({
              backgrounds: [change.input.background],
              files: change.input.files
            });
          }
          await repositories.chats.upsert(change.input.chat);
        });
        results.push({ applied: true, change });
        break;
      }

      case 'chatTheme.saved': {
        await input.repositories.transaction(async (repositories) => {
          await repositories.gifts.saveUpgradedGifts({
            files: change.input.files,
            gifts: change.input.upgradedGifts
          });
          await repositories.backgrounds.save({
            backgrounds: change.input.backgrounds,
            files: []
          });
          await repositories.chats.upsert(change.input.chat);
        });
        results.push({ applied: true, change });
        break;
      }

      case 'chat.updated': {
        await input.repositories.chats.upsert(change.chat);
        results.push({ applied: true, change });
        break;
      }

      case 'chat.positionsReplaced': {
        await input.repositories.chats.replacePositions(change.chatId, change.positions);
        results.push({ applied: true, change });
        break;
      }

      case 'chat.positionUpserted': {
        await input.repositories.chats.upsertPosition(change.position);
        results.push({ applied: true, change });
        break;
      }

      case 'chat.positionRemoved': {
        await input.repositories.chats.deletePosition(change.position);
        results.push({ applied: true, change });
        break;
      }

      case 'basicGroup.saved': {
        await input.repositories.groups.saveBasicGroup(change.group);
        results.push({ applied: true, change });
        break;
      }

      case 'basicGroup.fullInfoSaved': {
        await input.repositories.groups.saveBasicGroupFullInfo(change.info);
        results.push({ applied: true, change });
        break;
      }

      case 'supergroup.saved': {
        await input.repositories.groups.saveSupergroup(change.group);
        results.push({ applied: true, change });
        break;
      }

      case 'supergroup.fullInfoSaved': {
        await input.repositories.groups.saveSupergroupFullInfo(change.info);
        results.push({ applied: true, change });
        break;
      }

      case 'message.created': {
        const applied = await input.repositories.messages.save(change.message, {
          conflict: 'ignore'
        });
        if (applied) {
          publishMessageCreated(input.events, change.payload);
        }
        results.push({ applied, change });
        break;
      }

      case 'message.contentOpened': {
        const applied = await input.repositories.messages.markContentOpened(change.message);
        results.push({ applied, change });
        break;
      }

      case 'messageSend.acknowledged': {
        const applied = await input.repositories.messages.markSendAcknowledged(change.message);
        results.push({ applied, change });
        break;
      }

      case 'messageSchedulingState.cleared': {
        const applied = await input.repositories.messages.clearSchedulingState(change.message);
        results.push({ applied, change });
        break;
      }

      case 'messageSend.succeeded': {
        await input.repositories.transaction(async (repositories) => {
          await repositories.messages.save(change.currentMessage);
          await repositories.messages.clearSendAcknowledgement({
            chatId: change.currentMessage.chatId,
            messageId: change.currentMessage.id
          });
          if (change.oldMessage.messageId !== change.currentMessage.id) {
            await repositories.messages.delete({
              chatId: change.oldMessage.chatId,
              messageIds: [change.oldMessage.messageId]
            });
          }
        });
        results.push({ applied: true, change });
        break;
      }

      case 'messageSend.failed': {
        await input.repositories.transaction(async (repositories) => {
          await repositories.messages.save(change.currentMessage);
          if (change.oldMessage.messageId !== change.currentMessage.id) {
            await repositories.messages.delete({
              chatId: change.oldMessage.chatId,
              messageIds: [change.oldMessage.messageId]
            });
          }
        });
        results.push({ applied: true, change });
        break;
      }

      case 'message.updated': {
        await input.repositories.messages.upsert(change.message);
        if (change.payload !== null) {
          publishMessageUpdated(input.events, change.payload);
        }
        results.push({ applied: true, change });
        break;
      }

      case 'message.reactionUpdated': {
        const applied = await applyMessageReactionUpdate(input.repositories.messages, change);
        results.push({ applied, change });
        break;
      }

      case 'message.reactionSummariesReplaced': {
        await input.repositories.messages.replaceReactionSummaries(change.message);
        results.push({ applied: true, change });
        break;
      }

      case 'messages.deleted': {
        await input.repositories.messages.delete(change.messages);
        publishMessageDeleted(input.events, change.payload);
        results.push({ applied: true, change });
        break;
      }

      case 'user.saved': {
        await input.repositories.users.save(change.user);
        results.push({ applied: true, change });
        break;
      }

      case 'user.updated': {
        await input.repositories.users.upsert(change.user);
        results.push({ applied: true, change });
        break;
      }

      case 'user.fullInfoSaved': {
        await input.repositories.users.saveFullInfo(change.info);
        results.push({ applied: true, change });
        break;
      }

      default:
        assertUnhandledChange(change);
    }
  }
  return results;
}

function assertUnhandledChange(change: never): never {
  throw new Error(`Unhandled Telegram domain change: ${JSON.stringify(change)}`);
}
