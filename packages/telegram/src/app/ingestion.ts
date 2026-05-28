import { fileURLToPath } from 'node:url';

import type { TelegramDatabase as AppDatabase } from '../database/client.js';
import {
  readControlPlaneAssetVersions,
  watchControlPlaneAssetVersion,
  type ControlPlaneAssetVersionSubscription
} from '@agentg/infra/control-plane/assets';
import { createServiceDirectoryClient } from '@agentg/service-directory/rpc';
import type { EventBus } from '@agentg/events/bus';
import { createIntegrationEvent } from '@agentg/events/envelope';
import { createValidatedEventBus } from '@agentg/events/validated-bus';
import { serviceManifestEventTypes } from '@agentg/rpc/call-event-types';
import type { InternalTrpcBindConfig } from '@agentg/rpc/config';
import { createTelegramServiceManifest } from './registrations.js';
import { telegramRpc } from '../rpc/setup.js';
import {
  createTelegramClient,
  hasTelegramCredentials,
  type TelegramClientConfig
} from '../tdlib/client.js';
import {
  invokeTdlibWithEvents,
  type TdlibInvokeOptions,
  publishTdlibOperationEvents,
  publishTelegramOperationEvents
} from '../tdlib/operationEvents.js';
import { telegramTdlibPriorities } from '../tdlib/priority.js';
import { createTelegramFileSubsystem, type TelegramFileSubsystem } from '../files/subsystem.js';
import { createTelegramTdlibScheduler, type TelegramTdlibScheduler } from '../tdlib/scheduler.js';
import {
  createTelegramLiveCoverageObserver,
  type TelegramLiveCoverageObserver
} from '../history/liveCoverage.js';
import { createTelegramUpdateEventPublishers } from '../events/updateEventPublishers.js';
import { handleUpdateAccentColors } from '../tdlib/update-handlers/updateAccentColors.js';
import { handleUpdateActiveEmojiReactions } from '../tdlib/update-handlers/updateActiveEmojiReactions.js';
import { handleUpdateActiveGiftAuctions } from '../tdlib/update-handlers/updateActiveGiftAuctions.js';
import { handleUpdateActiveLiveLocationMessages } from '../tdlib/update-handlers/updateActiveLiveLocationMessages.js';
import { handleUpdateActiveNotifications } from '../tdlib/update-handlers/updateActiveNotifications.js';
import { handleUpdateAgeVerificationParameters } from '../tdlib/update-handlers/updateAgeVerificationParameters.js';
import { handleUpdateAnimatedEmojiMessageClicked } from '../tdlib/update-handlers/updateAnimatedEmojiMessageClicked.js';
import { handleUpdateAnimationSearchParameters } from '../tdlib/update-handlers/updateAnimationSearchParameters.js';
import { handleUpdateApplicationRecaptchaVerificationRequired } from '../tdlib/update-handlers/updateApplicationRecaptchaVerificationRequired.js';
import { handleUpdateApplicationVerificationRequired } from '../tdlib/update-handlers/updateApplicationVerificationRequired.js';
import { handleUpdateAttachmentMenuBots } from '../tdlib/update-handlers/updateAttachmentMenuBots.js';
import { handleUpdateAuthorizationState } from '../tdlib/update-handlers/updateAuthorizationState.js';
import { handleUpdateAutosaveSettings } from '../tdlib/update-handlers/updateAutosaveSettings.js';
import { handleUpdateAvailableMessageEffects } from '../tdlib/update-handlers/updateAvailableMessageEffects.js';
import { handleUpdateBasicGroup } from '../tdlib/update-handlers/updateBasicGroup.js';
import { handleUpdateBasicGroupFullInfo } from '../tdlib/update-handlers/updateBasicGroupFullInfo.js';
import { handleUpdateBusinessConnection } from '../tdlib/update-handlers/updateBusinessConnection.js';
import { handleUpdateBusinessMessageEdited } from '../tdlib/update-handlers/updateBusinessMessageEdited.js';
import { handleUpdateBusinessMessagesDeleted } from '../tdlib/update-handlers/updateBusinessMessagesDeleted.js';
import { handleUpdateCall } from '../tdlib/update-handlers/updateCall.js';
import { handleUpdateChatAccentColors } from '../tdlib/update-handlers/updateChatAccentColors.js';
import { handleUpdateChatAction } from '../tdlib/update-handlers/updateChatAction.js';
import { handleUpdateChatActionBar } from '../tdlib/update-handlers/updateChatActionBar.js';
import { handleUpdateChatActiveStories } from '../tdlib/update-handlers/updateChatActiveStories.js';
import { handleUpdateChatAddedToList } from '../tdlib/update-handlers/updateChatAddedToList.js';
import { handleUpdateChatAvailableReactions } from '../tdlib/update-handlers/updateChatAvailableReactions.js';
import { handleUpdateChatBackground } from '../tdlib/update-handlers/updateChatBackground.js';
import { handleUpdateChatBlockList } from '../tdlib/update-handlers/updateChatBlockList.js';
import { handleUpdateChatBoost } from '../tdlib/update-handlers/updateChatBoost.js';
import { handleUpdateChatBusinessBotManageBar } from '../tdlib/update-handlers/updateChatBusinessBotManageBar.js';
import { handleUpdateChatDefaultDisableNotification } from '../tdlib/update-handlers/updateChatDefaultDisableNotification.js';
import { handleUpdateChatDraftMessage } from '../tdlib/update-handlers/updateChatDraftMessage.js';
import { handleUpdateChatEmojiStatus } from '../tdlib/update-handlers/updateChatEmojiStatus.js';
import { handleUpdateChatFolders } from '../tdlib/update-handlers/updateChatFolders.js';
import { handleUpdateChatHasProtectedContent } from '../tdlib/update-handlers/updateChatHasProtectedContent.js';
import { handleUpdateChatHasScheduledMessages } from '../tdlib/update-handlers/updateChatHasScheduledMessages.js';
import { handleUpdateChatIsMarkedAsUnread } from '../tdlib/update-handlers/updateChatIsMarkedAsUnread.js';
import { handleUpdateChatIsTranslatable } from '../tdlib/update-handlers/updateChatIsTranslatable.js';
import { handleUpdateChatLastMessage } from '../tdlib/update-handlers/updateChatLastMessage.js';
import { handleUpdateChatMember } from '../tdlib/update-handlers/updateChatMember.js';
import { handleUpdateChatMessageAutoDeleteTime } from '../tdlib/update-handlers/updateChatMessageAutoDeleteTime.js';
import { handleUpdateChatMessageSender } from '../tdlib/update-handlers/updateChatMessageSender.js';
import { handleUpdateChatNotificationSettings } from '../tdlib/update-handlers/updateChatNotificationSettings.js';
import { handleUpdateChatOnlineMemberCount } from '../tdlib/update-handlers/updateChatOnlineMemberCount.js';
import { handleUpdateChatPendingJoinRequests } from '../tdlib/update-handlers/updateChatPendingJoinRequests.js';
import { handleUpdateChatPermissions } from '../tdlib/update-handlers/updateChatPermissions.js';
import { handleUpdateChatPhoto } from '../tdlib/update-handlers/updateChatPhoto.js';
import { handleUpdateChatPosition } from '../tdlib/update-handlers/updateChatPosition.js';
import { handleUpdateChatReadInbox } from '../tdlib/update-handlers/updateChatReadInbox.js';
import { handleUpdateChatReadOutbox } from '../tdlib/update-handlers/updateChatReadOutbox.js';
import { handleUpdateChatRemovedFromList } from '../tdlib/update-handlers/updateChatRemovedFromList.js';
import { handleUpdateChatReplyMarkup } from '../tdlib/update-handlers/updateChatReplyMarkup.js';
import { handleUpdateChatRevenueAmount } from '../tdlib/update-handlers/updateChatRevenueAmount.js';
import { handleUpdateChatTheme } from '../tdlib/update-handlers/updateChatTheme.js';
import { handleUpdateChatTitle } from '../tdlib/update-handlers/updateChatTitle.js';
import { handleUpdateChatUnreadMentionCount } from '../tdlib/update-handlers/updateChatUnreadMentionCount.js';
import { handleUpdateChatUnreadPollVoteCount } from '../tdlib/update-handlers/updateChatUnreadPollVoteCount.js';
import { handleUpdateChatUnreadReactionCount } from '../tdlib/update-handlers/updateChatUnreadReactionCount.js';
import { handleUpdateChatVideoChat } from '../tdlib/update-handlers/updateChatVideoChat.js';
import { handleUpdateChatViewAsTopics } from '../tdlib/update-handlers/updateChatViewAsTopics.js';
import { handleUpdateConnectionState } from '../tdlib/update-handlers/updateConnectionState.js';
import { handleUpdateContactCloseBirthdays } from '../tdlib/update-handlers/updateContactCloseBirthdays.js';
import { handleUpdateDefaultBackground } from '../tdlib/update-handlers/updateDefaultBackground.js';
import { handleUpdateDefaultPaidReactionType } from '../tdlib/update-handlers/updateDefaultPaidReactionType.js';
import { handleUpdateDefaultReactionType } from '../tdlib/update-handlers/updateDefaultReactionType.js';
import { handleUpdateDeleteMessages } from '../tdlib/update-handlers/updateDeleteMessages.js';
import { handleUpdateDiceEmojis } from '../tdlib/update-handlers/updateDiceEmojis.js';
import { handleUpdateDirectMessagesChatTopic } from '../tdlib/update-handlers/updateDirectMessagesChatTopic.js';
import { handleUpdateEmojiChatThemes } from '../tdlib/update-handlers/updateEmojiChatThemes.js';
import { handleUpdateFavoriteStickers } from '../tdlib/update-handlers/updateFavoriteStickers.js';
import { handleUpdateFile } from '../tdlib/update-handlers/updateFile.js';
import { handleUpdateFileAddedToDownloads } from '../tdlib/update-handlers/updateFileAddedToDownloads.js';
import { handleUpdateFileDownload } from '../tdlib/update-handlers/updateFileDownload.js';
import { handleUpdateFileDownloads } from '../tdlib/update-handlers/updateFileDownloads.js';
import { handleUpdateFileGenerationStart } from '../tdlib/update-handlers/updateFileGenerationStart.js';
import { handleUpdateFileGenerationStop } from '../tdlib/update-handlers/updateFileGenerationStop.js';
import { handleUpdateFileRemovedFromDownloads } from '../tdlib/update-handlers/updateFileRemovedFromDownloads.js';
import { handleUpdateForumTopic } from '../tdlib/update-handlers/updateForumTopic.js';
import { handleUpdateForumTopicInfo } from '../tdlib/update-handlers/updateForumTopicInfo.js';
import { handleUpdateFreezeState } from '../tdlib/update-handlers/updateFreezeState.js';
import { handleUpdateGiftAuctionState } from '../tdlib/update-handlers/updateGiftAuctionState.js';
import { handleUpdateGroupCall } from '../tdlib/update-handlers/updateGroupCall.js';
import { handleUpdateGroupCallMessageLevels } from '../tdlib/update-handlers/updateGroupCallMessageLevels.js';
import { handleUpdateGroupCallMessageSendFailed } from '../tdlib/update-handlers/updateGroupCallMessageSendFailed.js';
import { handleUpdateGroupCallMessagesDeleted } from '../tdlib/update-handlers/updateGroupCallMessagesDeleted.js';
import { handleUpdateGroupCallParticipant } from '../tdlib/update-handlers/updateGroupCallParticipant.js';
import { handleUpdateGroupCallParticipants } from '../tdlib/update-handlers/updateGroupCallParticipants.js';
import { handleUpdateGroupCallVerificationState } from '../tdlib/update-handlers/updateGroupCallVerificationState.js';
import { handleUpdateHavePendingNotifications } from '../tdlib/update-handlers/updateHavePendingNotifications.js';
import { handleUpdateInstalledStickerSets } from '../tdlib/update-handlers/updateInstalledStickerSets.js';
import { handleUpdateLanguagePackStrings } from '../tdlib/update-handlers/updateLanguagePackStrings.js';
import { handleUpdateLiveStoryTopDonors } from '../tdlib/update-handlers/updateLiveStoryTopDonors.js';
import { handleUpdateManagedBot } from '../tdlib/update-handlers/updateManagedBot.js';
import { handleUpdateMessageContainsUnreadPollVotes } from '../tdlib/update-handlers/updateMessageContainsUnreadPollVotes.js';
import { handleUpdateMessageContent } from '../tdlib/update-handlers/updateMessageContent.js';
import { handleUpdateMessageContentOpened } from '../tdlib/update-handlers/updateMessageContentOpened.js';
import { handleUpdateMessageEdited } from '../tdlib/update-handlers/updateMessageEdited.js';
import { handleUpdateMessageFactCheck } from '../tdlib/update-handlers/updateMessageFactCheck.js';
import { handleUpdateMessageInteractionInfo } from '../tdlib/update-handlers/updateMessageInteractionInfo.js';
import { handleUpdateMessageIsPinned } from '../tdlib/update-handlers/updateMessageIsPinned.js';
import { handleUpdateMessageLiveLocationViewed } from '../tdlib/update-handlers/updateMessageLiveLocationViewed.js';
import { handleUpdateMessageMentionRead } from '../tdlib/update-handlers/updateMessageMentionRead.js';
import { handleUpdateMessageReaction } from '../tdlib/update-handlers/updateMessageReaction.js';
import { handleUpdateMessageReactions } from '../tdlib/update-handlers/updateMessageReactions.js';
import { handleUpdateMessageSendAcknowledged } from '../tdlib/update-handlers/updateMessageSendAcknowledged.js';
import { handleUpdateMessageSendFailed } from '../tdlib/update-handlers/updateMessageSendFailed.js';
import { handleUpdateMessageSendSucceeded } from '../tdlib/update-handlers/updateMessageSendSucceeded.js';
import { handleUpdateMessageSuggestedPostInfo } from '../tdlib/update-handlers/updateMessageSuggestedPostInfo.js';
import { handleUpdateMessageUnreadReactions } from '../tdlib/update-handlers/updateMessageUnreadReactions.js';
import { handleUpdateNewBusinessCallbackQuery } from '../tdlib/update-handlers/updateNewBusinessCallbackQuery.js';
import { handleUpdateNewBusinessMessage } from '../tdlib/update-handlers/updateNewBusinessMessage.js';
import { handleUpdateNewCallbackQuery } from '../tdlib/update-handlers/updateNewCallbackQuery.js';
import { handleUpdateNewCallSignalingData } from '../tdlib/update-handlers/updateNewCallSignalingData.js';
import { handleUpdateNewChatJoinRequest } from '../tdlib/update-handlers/updateNewChatJoinRequest.js';
import { handleUpdateNewChat } from '../tdlib/update-handlers/updateNewChat.js';
import { handleUpdateNewChosenInlineResult } from '../tdlib/update-handlers/updateNewChosenInlineResult.js';
import { handleUpdateNewCustomEvent } from '../tdlib/update-handlers/updateNewCustomEvent.js';
import { handleUpdateNewCustomQuery } from '../tdlib/update-handlers/updateNewCustomQuery.js';
import { handleUpdateNewGuestQuery } from '../tdlib/update-handlers/updateNewGuestQuery.js';
import { handleUpdateNewGroupCallMessage } from '../tdlib/update-handlers/updateNewGroupCallMessage.js';
import { handleUpdateNewGroupCallPaidReaction } from '../tdlib/update-handlers/updateNewGroupCallPaidReaction.js';
import { handleUpdateNewInlineCallbackQuery } from '../tdlib/update-handlers/updateNewInlineCallbackQuery.js';
import { handleUpdateNewInlineQuery } from '../tdlib/update-handlers/updateNewInlineQuery.js';
import { handleUpdateNewMessage } from '../tdlib/update-handlers/updateNewMessage.js';
import { handleUpdateNewOauthRequest } from '../tdlib/update-handlers/updateNewOauthRequest.js';
import { handleUpdateNewPreCheckoutQuery } from '../tdlib/update-handlers/updateNewPreCheckoutQuery.js';
import { handleUpdateNewShippingQuery } from '../tdlib/update-handlers/updateNewShippingQuery.js';
import { handleUpdateNotification } from '../tdlib/update-handlers/updateNotification.js';
import { handleUpdateNotificationGroup } from '../tdlib/update-handlers/updateNotificationGroup.js';
import { handleUpdateOption } from '../tdlib/update-handlers/updateOption.js';
import { handleUpdateOwnedStarCount } from '../tdlib/update-handlers/updateOwnedStarCount.js';
import { handleUpdateOwnedTonCount } from '../tdlib/update-handlers/updateOwnedTonCount.js';
import { handleUpdatePaidMediaPurchased } from '../tdlib/update-handlers/updatePaidMediaPurchased.js';
import { handleUpdatePendingTextMessage } from '../tdlib/update-handlers/updatePendingTextMessage.js';
import { handleUpdatePoll } from '../tdlib/update-handlers/updatePoll.js';
import { handleUpdatePollAnswer } from '../tdlib/update-handlers/updatePollAnswer.js';
import { handleUpdateProfileAccentColors } from '../tdlib/update-handlers/updateProfileAccentColors.js';
import { handleUpdateQuickReplyShortcut } from '../tdlib/update-handlers/updateQuickReplyShortcut.js';
import { handleUpdateQuickReplyShortcutDeleted } from '../tdlib/update-handlers/updateQuickReplyShortcutDeleted.js';
import { handleUpdateQuickReplyShortcutMessages } from '../tdlib/update-handlers/updateQuickReplyShortcutMessages.js';
import { handleUpdateQuickReplyShortcuts } from '../tdlib/update-handlers/updateQuickReplyShortcuts.js';
import { handleUpdateReactionNotificationSettings } from '../tdlib/update-handlers/updateReactionNotificationSettings.js';
import { handleUpdateRecentStickers } from '../tdlib/update-handlers/updateRecentStickers.js';
import { handleUpdateSavedAnimations } from '../tdlib/update-handlers/updateSavedAnimations.js';
import { handleUpdateSavedMessagesTags } from '../tdlib/update-handlers/updateSavedMessagesTags.js';
import { handleUpdateSavedMessagesTopic } from '../tdlib/update-handlers/updateSavedMessagesTopic.js';
import { handleUpdateSavedMessagesTopicCount } from '../tdlib/update-handlers/updateSavedMessagesTopicCount.js';
import { handleUpdateSavedNotificationSounds } from '../tdlib/update-handlers/updateSavedNotificationSounds.js';
import { handleUpdateScopeNotificationSettings } from '../tdlib/update-handlers/updateScopeNotificationSettings.js';
import { handleUpdateSecretChat } from '../tdlib/update-handlers/updateSecretChat.js';
import { handleUpdateServiceNotification } from '../tdlib/update-handlers/updateServiceNotification.js';
import { handleUpdateSpeechRecognitionTrial } from '../tdlib/update-handlers/updateSpeechRecognitionTrial.js';
import { handleUpdateSpeedLimitNotification } from '../tdlib/update-handlers/updateSpeedLimitNotification.js';
import { handleUpdateStakeDiceState } from '../tdlib/update-handlers/updateStakeDiceState.js';
import { handleUpdateStarRevenueStatus } from '../tdlib/update-handlers/updateStarRevenueStatus.js';
import { handleUpdateStickerSet } from '../tdlib/update-handlers/updateStickerSet.js';
import { handleUpdateStory } from '../tdlib/update-handlers/updateStory.js';
import { handleUpdateStoryDeleted } from '../tdlib/update-handlers/updateStoryDeleted.js';
import { handleUpdateStoryListChatCount } from '../tdlib/update-handlers/updateStoryListChatCount.js';
import { handleUpdateStoryPostFailed } from '../tdlib/update-handlers/updateStoryPostFailed.js';
import { handleUpdateStoryPostSucceeded } from '../tdlib/update-handlers/updateStoryPostSucceeded.js';
import { handleUpdateStoryStealthMode } from '../tdlib/update-handlers/updateStoryStealthMode.js';
import { handleUpdateSuggestedActions } from '../tdlib/update-handlers/updateSuggestedActions.js';
import { handleUpdateSupergroup } from '../tdlib/update-handlers/updateSupergroup.js';
import { handleUpdateSupergroupFullInfo } from '../tdlib/update-handlers/updateSupergroupFullInfo.js';
import { handleUpdateTermsOfService } from '../tdlib/update-handlers/updateTermsOfService.js';
import { handleUpdateTextCompositionStyles } from '../tdlib/update-handlers/updateTextCompositionStyles.js';
import { handleUpdateTonRevenueStatus } from '../tdlib/update-handlers/updateTonRevenueStatus.js';
import { handleUpdateTopicMessageCount } from '../tdlib/update-handlers/updateTopicMessageCount.js';
import { handleUpdateTrendingStickerSets } from '../tdlib/update-handlers/updateTrendingStickerSets.js';
import { handleUpdateTrustedMiniAppBots } from '../tdlib/update-handlers/updateTrustedMiniAppBots.js';
import { handleUpdateUnconfirmedSession } from '../tdlib/update-handlers/updateUnconfirmedSession.js';
import { handleUpdateUnreadChatCount } from '../tdlib/update-handlers/updateUnreadChatCount.js';
import { handleUpdateUnreadMessageCount } from '../tdlib/update-handlers/updateUnreadMessageCount.js';
import { handleUpdateUser } from '../tdlib/update-handlers/updateUser.js';
import { handleUpdateUserFullInfo } from '../tdlib/update-handlers/updateUserFullInfo.js';
import { handleUpdateUserPrivacySettingRules } from '../tdlib/update-handlers/updateUserPrivacySettingRules.js';
import { handleUpdateUserStatus } from '../tdlib/update-handlers/updateUserStatus.js';
import { handleUpdateVideoPublished } from '../tdlib/update-handlers/updateVideoPublished.js';
import { handleUpdateWebAppMessageSent } from '../tdlib/update-handlers/updateWebAppMessageSent.js';
import { recordChatFiles, storeChat } from '../store/chat.js';
import { recordMessageFiles, storeMessage } from '../store/message.js';
import { storeUser } from '../store/user.js';
import type {
  TelegramWireChat,
  TelegramWireChats,
  TelegramWireObject,
  TelegramWireUpdate,
  TelegramWireUser
} from '../tdlib/wire.js';

export type TelegramIngestionOptions = {
  database: AppDatabase;
  eventBus: EventBus;
  internalRpc: InternalTrpcBindConfig;
  serviceRpcUrl: string;
  services: {
    serviceDirectory: {
      url: string;
    };
  };
  telegram: TelegramClientConfig;
};

type TelegramClient = Awaited<ReturnType<typeof createTelegramClient>>;

type ChatListKind = 'main' | 'archive';

type TdlibStatusState = {
  authenticated: boolean;
  connected: boolean;
};

type TdlibStatusTracker = {
  markAuthenticated(authenticated: boolean): void;
  markConnectionState(connectionState: string): boolean;
  markDisconnected(): void;
  publish(): void;
};

const TDLIB_STATUS_HEARTBEAT_MS = 5000;
const TELEGRAM_LIVE_COVERAGE_TICK_MS = 30_000;
const TELEGRAM_SHUTDOWN_FORCE_EXIT_MS = 4500;
const TELEGRAM_SHUTDOWN_STEP_TIMEOUT_MS = 2000;
const TELEGRAM_CONTROL_PLANE_ASSETS_ROOT = fileURLToPath(
  new URL('../../dist-control-plane/', import.meta.url)
);

export async function runTelegramIngestion(options: TelegramIngestionOptions): Promise<void> {
  const initialControlPlaneAssets = await readControlPlaneAssetVersions(
    TELEGRAM_CONTROL_PLANE_ASSETS_ROOT
  );
  const serviceManifest = createTelegramServiceManifest({
    controlPlaneAssetVersion: initialControlPlaneAssets.version,
    controlPlaneAssetVersions: initialControlPlaneAssets.assets,
    rpcUrl: options.serviceRpcUrl
  });
  const eventBus = createValidatedEventBus(options.eventBus, {
    allowedTypes: serviceManifestEventTypes(serviceManifest),
    publisher: 'telegram'
  });
  let telegramRpcServer: Awaited<ReturnType<typeof telegramRpc.startServer>> | undefined;
  let controlPlaneAssets: ControlPlaneAssetVersionSubscription | undefined;
  let serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  let tdlibStatusHeartbeat: ReturnType<typeof setInterval> | undefined;
  let fileSubsystem: TelegramFileSubsystem | undefined;
  let liveCoverageObserver: TelegramLiveCoverageObserver | undefined;
  let liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  let tdlibScheduler: TelegramTdlibScheduler | undefined;
  let client: TelegramClient | undefined;
  let tdlibStatus: TdlibStatusTracker | undefined;
  let startupComplete = false;

  try {
    if (!hasTelegramCredentials(options.telegram)) {
      throw new Error('Telegram ingestion requires TELEGRAM_API_ID and TELEGRAM_API_HASH');
    }

    client = await createTelegramClient(options.telegram);
    const activeClient = client;
    tdlibScheduler = createTelegramTdlibScheduler(activeClient);
    const activeTdlibScheduler = tdlibScheduler;
    fileSubsystem = createTelegramFileSubsystem({
      client: activeTdlibScheduler,
      database: options.database,
      eventBus,
      filesDirectory: options.telegram.filesDirectory
    });
    const activeFileSubsystem = fileSubsystem;
    const updateEventPublishers = createTelegramUpdateEventPublishers(eventBus, options.database);
    tdlibStatus = createTdlibStatusTracker(eventBus);
    const activeTdlibStatus = tdlibStatus;
    liveCoverageObserver = createTelegramLiveCoverageObserver({
      database: options.database
    });
    const activeLiveCoverageObserver = liveCoverageObserver;

    activeClient.on('error', (error: unknown) => {
      console.error(JSON.stringify({ event: 'telegram.error', error: String(error) }));
    });
    activeClient.on('update', (update) => {
      void persistLiveUpdate(
        options.database,
        update,
        updateEventPublishers,
        activeFileSubsystem,
        activeLiveCoverageObserver,
        activeTdlibStatus
      );
    });

    await publishTelegramOperationEvents(eventBus, 'login', {}, () => activeClient.login());
    await persistAndLogAuthenticatedClient(options.database, activeTdlibScheduler, eventBus);
    activeTdlibStatus.markAuthenticated(true);
    activeTdlibStatus.markConnectionState('connectionStateReady');
    await activeLiveCoverageObserver.markConnected();
    tdlibStatusHeartbeat = startTdlibStatusHeartbeat(activeTdlibStatus);
    liveCoverageTick = setInterval(() => {
      void activeLiveCoverageObserver.tick();
    }, TELEGRAM_LIVE_COVERAGE_TICK_MS);
    await syncInitialChats(options.database, activeTdlibScheduler, eventBus, activeFileSubsystem);
    await activeLiveCoverageObserver.syncKnownChats();

    telegramRpcServer = await telegramRpc.startServer({
      bind: options.internalRpc,
      eventBus,
      deps: {
        client: activeTdlibScheduler,
        database: options.database,
        eventBus,
        files: activeFileSubsystem
      },
      staticAssets: [
        {
          rootDir: TELEGRAM_CONTROL_PLANE_ASSETS_ROOT,
          urlPrefix: '/control-plane-assets/'
        },
        {
          rootDir: options.telegram.filesDirectory,
          urlPrefix: '/telegram-files/'
        }
      ]
    });
    serviceDirectory = createServiceDirectoryClient({
      eventBus,
      onTopologyFailure: (error) => {
        requestProcessShutdown('telegram.topology_failure', error);
      },
      url: options.services.serviceDirectory.url
    });
    await serviceDirectory.join(serviceManifest);
    const activeServiceDirectory = serviceDirectory;
    controlPlaneAssets = watchControlPlaneAssetVersion({
      initialVersion: initialControlPlaneAssets,
      onError: (error) => {
        requestProcessShutdown('telegram.control_plane_assets_registration_failed', error);
      },
      onVersion: async (nextControlPlaneAssets) => {
        await activeServiceDirectory.join(
          createTelegramServiceManifest({
            controlPlaneAssetVersion: nextControlPlaneAssets.version,
            controlPlaneAssetVersions: nextControlPlaneAssets.assets,
            rpcUrl: options.serviceRpcUrl
          })
        );
        console.log(
          JSON.stringify({
            event: 'telegram.control_plane_assets_registered',
            version: nextControlPlaneAssets.version
          })
        );
      },
      rootDir: TELEGRAM_CONTROL_PLANE_ASSETS_ROOT
    });
    startupComplete = true;

    console.log(JSON.stringify({ event: 'telegram.ingestion_ready' }));
    await waitForShutdown(async () => {
      controlPlaneAssets?.close();
      controlPlaneAssets = undefined;
      if (tdlibStatusHeartbeat !== undefined) {
        clearInterval(tdlibStatusHeartbeat);
        tdlibStatusHeartbeat = undefined;
      }
      if (liveCoverageTick !== undefined) {
        clearInterval(liveCoverageTick);
        liveCoverageTick = undefined;
      }
      fileSubsystem?.close();
      fileSubsystem = undefined;
      activeTdlibScheduler.close();
      tdlibScheduler = undefined;
      await activeLiveCoverageObserver.markDisconnected();
      activeTdlibStatus.markDisconnected();
      const activeTelegramRpcServer = telegramRpcServer;
      const telegramRpcClosed =
        activeTelegramRpcServer === undefined
          ? true
          : await runShutdownStep('telegram.trpc_close', () =>
              telegramRpc.stopServer(activeTelegramRpcServer)
            );
      if (telegramRpcClosed) {
        telegramRpcServer = undefined;
      }
      serviceDirectory?.close();
      serviceDirectory = undefined;
      const tdlibClosed = await runShutdownStep('telegram.tdlib.close', () =>
        publishTdlibOperationEvents(eventBus, 'close', {}, () => activeClient.close())
      );
      const [liveCoverageStopped, eventBusClosed] = await Promise.all([
        runShutdownStep('telegram.live_coverage_wait', () => activeLiveCoverageObserver.wait()),
        runShutdownStep('telegram.event_bus_close', () => eventBus.close())
      ]);

      return telegramRpcClosed && tdlibClosed && liveCoverageStopped && eventBusClosed;
    });
  } catch (error) {
    if (!startupComplete) {
      await cleanupTelegramStartupFailure({
        client,
        controlPlaneAssets,
        eventBus,
        fileSubsystem,
        liveCoverageObserver,
        liveCoverageTick,
        serviceDirectory,
        tdlibStatus,
        tdlibScheduler,
        tdlibStatusHeartbeat,
        telegramRpcServer
      });
    }
    throw error;
  }
}

async function cleanupTelegramStartupFailure(options: {
  client: TelegramClient | undefined;
  controlPlaneAssets: ControlPlaneAssetVersionSubscription | undefined;
  eventBus: EventBus;
  fileSubsystem: TelegramFileSubsystem | undefined;
  liveCoverageObserver: TelegramLiveCoverageObserver | undefined;
  liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  tdlibStatus: TdlibStatusTracker | undefined;
  tdlibScheduler: TelegramTdlibScheduler | undefined;
  tdlibStatusHeartbeat: ReturnType<typeof setInterval> | undefined;
  telegramRpcServer: Awaited<ReturnType<typeof telegramRpc.startServer>> | undefined;
}): Promise<void> {
  options.controlPlaneAssets?.close();
  if (options.tdlibStatusHeartbeat !== undefined) {
    clearInterval(options.tdlibStatusHeartbeat);
  }
  if (options.liveCoverageTick !== undefined) {
    clearInterval(options.liveCoverageTick);
  }
  options.fileSubsystem?.close();
  options.tdlibScheduler?.close();
  await runShutdownStep('telegram.live_coverage_startup_disconnect', () =>
    Promise.resolve(options.liveCoverageObserver?.markDisconnected())
  );
  await runShutdownStep('telegram.tdlib_status_startup_disconnect', () =>
    Promise.resolve(options.tdlibStatus?.markDisconnected())
  );

  const telegramRpcServer = options.telegramRpcServer;
  if (telegramRpcServer !== undefined) {
    await runShutdownStep('telegram.trpc_startup_close', () =>
      telegramRpc.stopServer(telegramRpcServer)
    );
  }

  await runShutdownStep('telegram.service_directory_startup_close', () =>
    Promise.resolve(options.serviceDirectory?.close())
  );
  const client = options.client;
  if (client !== undefined) {
    await runShutdownStep('telegram.tdlib_startup_close', () =>
      publishTdlibOperationEvents(options.eventBus, 'close', {}, () => client.close())
    );
  }
  await Promise.all([
    runShutdownStep('telegram.live_coverage_startup_wait', () =>
      Promise.resolve(options.liveCoverageObserver?.wait())
    ),
    runShutdownStep('telegram.event_bus_startup_close', () => options.eventBus.close())
  ]);
}

function requestProcessShutdown(event: string, error: Error): void {
  console.error(
    JSON.stringify({
      error: error.message,
      event
    })
  );
  process.exitCode = 1;
  process.kill(process.pid, 'SIGTERM');
}

function startTdlibStatusHeartbeat(status: TdlibStatusTracker): ReturnType<typeof setInterval> {
  status.publish();
  return setInterval(() => {
    status.publish();
  }, TDLIB_STATUS_HEARTBEAT_MS);
}

function createTdlibStatusTracker(eventBus: EventBus): TdlibStatusTracker {
  const state: TdlibStatusState = {
    authenticated: false,
    connected: false
  };

  const publish = (): void => {
    eventBus.publish(
      createIntegrationEvent({
        data: {
          authenticated: state.authenticated,
          connected: state.connected
        },
        type: 'telegram.status'
      })
    );
  };

  return {
    markAuthenticated(authenticated: boolean): void {
      state.authenticated = authenticated;
      state.connected = authenticated;
      publish();
    },
    markConnectionState(connectionState: string): boolean {
      state.connected = state.authenticated;
      publish();
      return isTdlibLiveCoverageConnectionState(connectionState);
    },
    markDisconnected(): void {
      state.connected = false;
      publish();
    },
    publish
  };
}

async function persistAndLogAuthenticatedClient(
  database: AppDatabase,
  client: TelegramTdlibScheduler,
  eventBus: EventBus
): Promise<void> {
  const me = (await invokeTdlib(
    eventBus,
    client,
    { _: 'getMe' },
    { priority: telegramTdlibPriorities.maximum }
  )) as TelegramWireUser;
  await storeUser(database, me);

  const chats = (await invokeTdlib(
    eventBus,
    client,
    {
      _: 'getChats',
      chat_list: { _: 'chatListMain' },
      limit: 20
    },
    { priority: telegramTdlibPriorities.maximum }
  )) as TelegramWireChats;

  console.log(
    JSON.stringify({
      event: 'telegram.authenticated',
      me: summarizeCurrentUser(me),
      chatCount: chats.chat_ids.length
    })
  );
}

async function persistLiveUpdate(
  database: AppDatabase,
  update: TelegramWireUpdate,
  updateEventPublishers: ReturnType<typeof createTelegramUpdateEventPublishers>,
  files: TelegramFileSubsystem,
  liveCoverageObserver: TelegramLiveCoverageObserver,
  tdlibStatus: TdlibStatusTracker
): Promise<void> {
  const context = {
    database,
    events: updateEventPublishers,
    files,
    liveCoverageObserver,
    tdlibStatus
  };

  switch (update._) {
    case 'updateAccentColors':
      await handleUpdateAccentColors(context, update);
      return;
    case 'updateActiveEmojiReactions':
      await handleUpdateActiveEmojiReactions(context, update);
      return;
    case 'updateActiveGiftAuctions':
      await handleUpdateActiveGiftAuctions(context, update);
      return;
    case 'updateActiveLiveLocationMessages':
      await handleUpdateActiveLiveLocationMessages(context, update);
      return;
    case 'updateActiveNotifications':
      await handleUpdateActiveNotifications(context, update);
      return;
    case 'updateAgeVerificationParameters':
      await handleUpdateAgeVerificationParameters(context, update);
      return;
    case 'updateAnimatedEmojiMessageClicked':
      await handleUpdateAnimatedEmojiMessageClicked(context, update);
      return;
    case 'updateAnimationSearchParameters':
      await handleUpdateAnimationSearchParameters(context, update);
      return;
    case 'updateApplicationRecaptchaVerificationRequired':
      handleUpdateApplicationRecaptchaVerificationRequired(context, update);
      return;
    case 'updateApplicationVerificationRequired':
      handleUpdateApplicationVerificationRequired(context, update);
      return;
    case 'updateAttachmentMenuBots':
      await handleUpdateAttachmentMenuBots(context, update);
      return;
    case 'updateAuthorizationState':
      await handleUpdateAuthorizationState(context, update);
      return;
    case 'updateAutosaveSettings':
      await handleUpdateAutosaveSettings(context, update);
      return;
    case 'updateAvailableMessageEffects':
      await handleUpdateAvailableMessageEffects(context, update);
      return;
    case 'updateBasicGroup':
      await handleUpdateBasicGroup(context, update);
      return;
    case 'updateBasicGroupFullInfo':
      await handleUpdateBasicGroupFullInfo(context, update);
      return;
    case 'updateBusinessConnection':
      await handleUpdateBusinessConnection(context, update);
      return;
    case 'updateBusinessMessageEdited':
      await handleUpdateBusinessMessageEdited(context, update);
      return;
    case 'updateBusinessMessagesDeleted':
      await handleUpdateBusinessMessagesDeleted(context, update);
      return;
    case 'updateCall':
      await handleUpdateCall(context, update);
      return;
    case 'updateChatAccentColors':
      await handleUpdateChatAccentColors(context, update);
      return;
    case 'updateChatAction':
      handleUpdateChatAction(context, update);
      return;
    case 'updateChatActionBar':
      await handleUpdateChatActionBar(context, update);
      return;
    case 'updateChatActiveStories':
      await handleUpdateChatActiveStories(context, update);
      return;
    case 'updateChatAddedToList':
      await handleUpdateChatAddedToList(context, update);
      return;
    case 'updateChatAvailableReactions':
      await handleUpdateChatAvailableReactions(context, update);
      return;
    case 'updateChatBackground':
      await handleUpdateChatBackground(context, update);
      return;
    case 'updateChatBlockList':
      await handleUpdateChatBlockList(context, update);
      return;
    case 'updateChatBoost':
      await handleUpdateChatBoost(context, update);
      return;
    case 'updateChatBusinessBotManageBar':
      await handleUpdateChatBusinessBotManageBar(context, update);
      return;
    case 'updateChatDefaultDisableNotification':
      await handleUpdateChatDefaultDisableNotification(context, update);
      return;
    case 'updateChatDraftMessage':
      await handleUpdateChatDraftMessage(context, update);
      return;
    case 'updateChatEmojiStatus':
      await handleUpdateChatEmojiStatus(context, update);
      return;
    case 'updateChatFolders':
      await handleUpdateChatFolders(context, update);
      return;
    case 'updateChatHasProtectedContent':
      await handleUpdateChatHasProtectedContent(context, update);
      return;
    case 'updateChatHasScheduledMessages':
      await handleUpdateChatHasScheduledMessages(context, update);
      return;
    case 'updateChatIsMarkedAsUnread':
      await handleUpdateChatIsMarkedAsUnread(context, update);
      return;
    case 'updateChatIsTranslatable':
      await handleUpdateChatIsTranslatable(context, update);
      return;
    case 'updateChatLastMessage':
      await handleUpdateChatLastMessage(context, update);
      return;
    case 'updateChatMember':
      await handleUpdateChatMember(context, update);
      return;
    case 'updateChatMessageAutoDeleteTime':
      await handleUpdateChatMessageAutoDeleteTime(context, update);
      return;
    case 'updateChatMessageSender':
      await handleUpdateChatMessageSender(context, update);
      return;
    case 'updateChatNotificationSettings':
      await handleUpdateChatNotificationSettings(context, update);
      return;
    case 'updateChatOnlineMemberCount':
      handleUpdateChatOnlineMemberCount(context, update);
      return;
    case 'updateChatPendingJoinRequests':
      await handleUpdateChatPendingJoinRequests(context, update);
      return;
    case 'updateChatPermissions':
      await handleUpdateChatPermissions(context, update);
      return;
    case 'updateChatPhoto':
      await handleUpdateChatPhoto(context, update);
      return;
    case 'updateChatPosition':
      await handleUpdateChatPosition(context, update);
      return;
    case 'updateChatReadInbox':
      await handleUpdateChatReadInbox(context, update);
      return;
    case 'updateChatReadOutbox':
      await handleUpdateChatReadOutbox(context, update);
      return;
    case 'updateChatRemovedFromList':
      await handleUpdateChatRemovedFromList(context, update);
      return;
    case 'updateChatReplyMarkup':
      await handleUpdateChatReplyMarkup(context, update);
      return;
    case 'updateChatRevenueAmount':
      await handleUpdateChatRevenueAmount(context, update);
      return;
    case 'updateChatTheme':
      await handleUpdateChatTheme(context, update);
      return;
    case 'updateChatTitle':
      await handleUpdateChatTitle(context, update);
      return;
    case 'updateChatUnreadMentionCount':
      await handleUpdateChatUnreadMentionCount(context, update);
      return;
    case 'updateChatUnreadPollVoteCount':
      await handleUpdateChatUnreadPollVoteCount(context, update);
      return;
    case 'updateChatUnreadReactionCount':
      await handleUpdateChatUnreadReactionCount(context, update);
      return;
    case 'updateChatVideoChat':
      await handleUpdateChatVideoChat(context, update);
      return;
    case 'updateChatViewAsTopics':
      await handleUpdateChatViewAsTopics(context, update);
      return;
    case 'updateConnectionState':
      await handleUpdateConnectionState(context, update);
      return;
    case 'updateContactCloseBirthdays':
      await handleUpdateContactCloseBirthdays(context, update);
      return;
    case 'updateDefaultBackground':
      await handleUpdateDefaultBackground(context, update);
      return;
    case 'updateDefaultPaidReactionType':
      await handleUpdateDefaultPaidReactionType(context, update);
      return;
    case 'updateDefaultReactionType':
      await handleUpdateDefaultReactionType(context, update);
      return;
    case 'updateDeleteMessages':
      await handleUpdateDeleteMessages(context, update);
      return;
    case 'updateDiceEmojis':
      await handleUpdateDiceEmojis(context, update);
      return;
    case 'updateDirectMessagesChatTopic':
      await handleUpdateDirectMessagesChatTopic(context, update);
      return;
    case 'updateEmojiChatThemes':
      await handleUpdateEmojiChatThemes(context, update);
      return;
    case 'updateFavoriteStickers':
      await handleUpdateFavoriteStickers(context, update);
      return;
    case 'updateFile':
      await handleUpdateFile(context, update);
      return;
    case 'updateFileAddedToDownloads':
      await handleUpdateFileAddedToDownloads(context, update);
      return;
    case 'updateFileDownload':
      await handleUpdateFileDownload(context, update);
      return;
    case 'updateFileDownloads':
      await handleUpdateFileDownloads(context, update);
      return;
    case 'updateFileGenerationStart':
      await handleUpdateFileGenerationStart(context, update);
      return;
    case 'updateFileGenerationStop':
      await handleUpdateFileGenerationStop(context, update);
      return;
    case 'updateFileRemovedFromDownloads':
      await handleUpdateFileRemovedFromDownloads(context, update);
      return;
    case 'updateForumTopic':
      await handleUpdateForumTopic(context, update);
      return;
    case 'updateForumTopicInfo':
      await handleUpdateForumTopicInfo(context, update);
      return;
    case 'updateFreezeState':
      await handleUpdateFreezeState(context, update);
      return;
    case 'updateGiftAuctionState':
      await handleUpdateGiftAuctionState(context, update);
      return;
    case 'updateGroupCall':
      await handleUpdateGroupCall(context, update);
      return;
    case 'updateGroupCallMessageLevels':
      await handleUpdateGroupCallMessageLevels(context, update);
      return;
    case 'updateGroupCallMessageSendFailed':
      await handleUpdateGroupCallMessageSendFailed(context, update);
      return;
    case 'updateGroupCallMessagesDeleted':
      await handleUpdateGroupCallMessagesDeleted(context, update);
      return;
    case 'updateGroupCallParticipant':
      await handleUpdateGroupCallParticipant(context, update);
      return;
    case 'updateGroupCallParticipants':
      await handleUpdateGroupCallParticipants(context, update);
      return;
    case 'updateGroupCallVerificationState':
      await handleUpdateGroupCallVerificationState(context, update);
      return;
    case 'updateHavePendingNotifications':
      handleUpdateHavePendingNotifications(context, update);
      return;
    case 'updateInstalledStickerSets':
      await handleUpdateInstalledStickerSets(context, update);
      return;
    case 'updateLanguagePackStrings':
      await handleUpdateLanguagePackStrings(context, update);
      return;
    case 'updateLiveStoryTopDonors':
      await handleUpdateLiveStoryTopDonors(context, update);
      return;
    case 'updateManagedBot':
      await handleUpdateManagedBot(context, update);
      return;
    case 'updateMessageContainsUnreadPollVotes':
      await handleUpdateMessageContainsUnreadPollVotes(context, update);
      return;
    case 'updateMessageContent':
      await handleUpdateMessageContent(context, update);
      return;
    case 'updateMessageContentOpened':
      await handleUpdateMessageContentOpened(context, update);
      return;
    case 'updateMessageEdited':
      await handleUpdateMessageEdited(context, update);
      return;
    case 'updateMessageFactCheck':
      await handleUpdateMessageFactCheck(context, update);
      return;
    case 'updateMessageInteractionInfo':
      await handleUpdateMessageInteractionInfo(context, update);
      return;
    case 'updateMessageIsPinned':
      await handleUpdateMessageIsPinned(context, update);
      return;
    case 'updateMessageLiveLocationViewed':
      handleUpdateMessageLiveLocationViewed(context, update);
      return;
    case 'updateMessageMentionRead':
      await handleUpdateMessageMentionRead(context, update);
      return;
    case 'updateMessageReaction':
      await handleUpdateMessageReaction(context, update);
      return;
    case 'updateMessageReactions':
      await handleUpdateMessageReactions(context, update);
      return;
    case 'updateMessageSendAcknowledged':
      await handleUpdateMessageSendAcknowledged(context, update);
      return;
    case 'updateMessageSendFailed':
      await handleUpdateMessageSendFailed(context, update);
      return;
    case 'updateMessageSendSucceeded':
      await handleUpdateMessageSendSucceeded(context, update);
      return;
    case 'updateMessageSuggestedPostInfo':
      await handleUpdateMessageSuggestedPostInfo(context, update);
      return;
    case 'updateMessageUnreadReactions':
      await handleUpdateMessageUnreadReactions(context, update);
      return;
    case 'updateNewBusinessCallbackQuery':
      await handleUpdateNewBusinessCallbackQuery(context, update);
      return;
    case 'updateNewBusinessMessage':
      await handleUpdateNewBusinessMessage(context, update);
      return;
    case 'updateNewCallbackQuery':
      handleUpdateNewCallbackQuery(context, update);
      return;
    case 'updateNewCallSignalingData':
      handleUpdateNewCallSignalingData(context, update);
      return;
    case 'updateNewChatJoinRequest':
      await handleUpdateNewChatJoinRequest(context, update);
      return;
    case 'updateNewChat':
      await handleUpdateNewChat(context, update);
      return;
    case 'updateNewChosenInlineResult':
      handleUpdateNewChosenInlineResult(context, update);
      return;
    case 'updateNewCustomEvent':
      handleUpdateNewCustomEvent(context, update);
      return;
    case 'updateNewCustomQuery':
      handleUpdateNewCustomQuery(context, update);
      return;
    case 'updateNewGuestQuery':
      await handleUpdateNewGuestQuery(context, update);
      return;
    case 'updateNewGroupCallMessage':
      await handleUpdateNewGroupCallMessage(context, update);
      return;
    case 'updateNewGroupCallPaidReaction':
      handleUpdateNewGroupCallPaidReaction(context, update);
      return;
    case 'updateNewInlineCallbackQuery':
      handleUpdateNewInlineCallbackQuery(context, update);
      return;
    case 'updateNewInlineQuery':
      handleUpdateNewInlineQuery(context, update);
      return;
    case 'updateNewMessage':
      await handleUpdateNewMessage(context, update);
      return;
    case 'updateNewOauthRequest':
      handleUpdateNewOauthRequest(context, update);
      return;
    case 'updateNewPreCheckoutQuery':
      handleUpdateNewPreCheckoutQuery(context, update);
      return;
    case 'updateNewShippingQuery':
      handleUpdateNewShippingQuery(context, update);
      return;
    case 'updateNotification':
      await handleUpdateNotification(context, update);
      return;
    case 'updateNotificationGroup':
      await handleUpdateNotificationGroup(context, update);
      return;
    case 'updateOption':
      await handleUpdateOption(context, update);
      return;
    case 'updateOwnedStarCount':
      await handleUpdateOwnedStarCount(context, update);
      return;
    case 'updateOwnedTonCount':
      await handleUpdateOwnedTonCount(context, update);
      return;
    case 'updatePaidMediaPurchased':
      handleUpdatePaidMediaPurchased(context, update);
      return;
    case 'updatePendingTextMessage':
      handleUpdatePendingTextMessage(context, update);
      return;
    case 'updatePoll':
      await handleUpdatePoll(context, update);
      return;
    case 'updatePollAnswer':
      await handleUpdatePollAnswer(context, update);
      return;
    case 'updateProfileAccentColors':
      await handleUpdateProfileAccentColors(context, update);
      return;
    case 'updateQuickReplyShortcut':
      await handleUpdateQuickReplyShortcut(context, update);
      return;
    case 'updateQuickReplyShortcutDeleted':
      await handleUpdateQuickReplyShortcutDeleted(context, update);
      return;
    case 'updateQuickReplyShortcutMessages':
      await handleUpdateQuickReplyShortcutMessages(context, update);
      return;
    case 'updateQuickReplyShortcuts':
      await handleUpdateQuickReplyShortcuts(context, update);
      return;
    case 'updateReactionNotificationSettings':
      await handleUpdateReactionNotificationSettings(context, update);
      return;
    case 'updateRecentStickers':
      await handleUpdateRecentStickers(context, update);
      return;
    case 'updateSavedAnimations':
      await handleUpdateSavedAnimations(context, update);
      return;
    case 'updateSavedMessagesTags':
      await handleUpdateSavedMessagesTags(context, update);
      return;
    case 'updateSavedMessagesTopic':
      await handleUpdateSavedMessagesTopic(context, update);
      return;
    case 'updateSavedMessagesTopicCount':
      await handleUpdateSavedMessagesTopicCount(context, update);
      return;
    case 'updateSavedNotificationSounds':
      await handleUpdateSavedNotificationSounds(context, update);
      return;
    case 'updateScopeNotificationSettings':
      await handleUpdateScopeNotificationSettings(context, update);
      return;
    case 'updateSecretChat':
      await handleUpdateSecretChat(context, update);
      return;
    case 'updateServiceNotification':
      await handleUpdateServiceNotification(context, update);
      return;
    case 'updateSpeechRecognitionTrial':
      await handleUpdateSpeechRecognitionTrial(context, update);
      return;
    case 'updateSpeedLimitNotification':
      await handleUpdateSpeedLimitNotification(context, update);
      return;
    case 'updateStakeDiceState':
      await handleUpdateStakeDiceState(context, update);
      return;
    case 'updateStarRevenueStatus':
      await handleUpdateStarRevenueStatus(context, update);
      return;
    case 'updateStickerSet':
      await handleUpdateStickerSet(context, update);
      return;
    case 'updateStory':
      await handleUpdateStory(context, update);
      return;
    case 'updateStoryDeleted':
      await handleUpdateStoryDeleted(context, update);
      return;
    case 'updateStoryListChatCount':
      await handleUpdateStoryListChatCount(context, update);
      return;
    case 'updateStoryPostFailed':
      await handleUpdateStoryPostFailed(context, update);
      return;
    case 'updateStoryPostSucceeded':
      await handleUpdateStoryPostSucceeded(context, update);
      return;
    case 'updateStoryStealthMode':
      await handleUpdateStoryStealthMode(context, update);
      return;
    case 'updateSuggestedActions':
      await handleUpdateSuggestedActions(context, update);
      return;
    case 'updateSupergroup':
      await handleUpdateSupergroup(context, update);
      return;
    case 'updateSupergroupFullInfo':
      await handleUpdateSupergroupFullInfo(context, update);
      return;
    case 'updateTermsOfService':
      await handleUpdateTermsOfService(context, update);
      return;
    case 'updateTextCompositionStyles':
      await handleUpdateTextCompositionStyles(context, update);
      return;
    case 'updateTonRevenueStatus':
      await handleUpdateTonRevenueStatus(context, update);
      return;
    case 'updateTopicMessageCount':
      await handleUpdateTopicMessageCount(context, update);
      return;
    case 'updateTrendingStickerSets':
      await handleUpdateTrendingStickerSets(context, update);
      return;
    case 'updateTrustedMiniAppBots':
      await handleUpdateTrustedMiniAppBots(context, update);
      return;
    case 'updateUnconfirmedSession':
      await handleUpdateUnconfirmedSession(context, update);
      return;
    case 'updateUnreadChatCount':
      await handleUpdateUnreadChatCount(context, update);
      return;
    case 'updateUnreadMessageCount':
      await handleUpdateUnreadMessageCount(context, update);
      return;
    case 'updateUser':
      await handleUpdateUser(context, update);
      return;
    case 'updateUserFullInfo':
      await handleUpdateUserFullInfo(context, update);
      return;
    case 'updateUserPrivacySettingRules':
      await handleUpdateUserPrivacySettingRules(context, update);
      return;
    case 'updateUserStatus':
      await handleUpdateUserStatus(context, update);
      return;
    case 'updateVideoPublished':
      await handleUpdateVideoPublished(context, update);
      return;
    case 'updateWebAppMessageSent':
      await handleUpdateWebAppMessageSent(context, update);
      return;
  }

  const unhandledUpdate = update as { _: string };
  console.error(
    JSON.stringify({
      event: 'telegram.tdlib_update_unhandled',
      level: 'error',
      updateType: unhandledUpdate._
    })
  );
}

async function syncInitialChats(
  database: AppDatabase,
  client: TelegramTdlibScheduler,
  eventBus: EventBus,
  files: TelegramFileSubsystem,
  limit = 100
): Promise<void> {
  const chatIds = await getMainChatIds(eventBus, client, limit);
  let storedChatCount = 0;

  for (const chatId of chatIds) {
    const chat = (await invokeTdlib(
      eventBus,
      client,
      { _: 'getChat', chat_id: chatId },
      {
        priority: telegramTdlibPriorities.maximum
      }
    )) as TelegramWireChat;
    const lastMessage = chat.last_message ?? null;
    await database.transaction(async (transaction) => {
      if (lastMessage !== null) {
        await storeMessage(transaction, lastMessage);
      }

      await storeChat(transaction, chat);
    });

    await recordChatFiles(files, chat, 'initialization');
    if (lastMessage !== null) {
      await recordMessageFiles(files, lastMessage, 'initialization');
    }
    storedChatCount += 1;
  }

  console.log(
    JSON.stringify({
      event: 'telegram.initial_chats_synced',
      storedChatCount
    })
  );
}

async function getMainChatIds(
  eventBus: EventBus,
  client: TelegramTdlibScheduler,
  limit: number
): Promise<number[]> {
  return getChatIds(eventBus, client, 'main', limit);
}

async function getChatIds(
  eventBus: EventBus,
  client: TelegramTdlibScheduler,
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  let chats: TelegramWireChats | undefined;
  try {
    chats = (await invokeTdlib(
      eventBus,
      client,
      {
        _: 'getChats',
        chat_list: toTdChatList(chatList),
        limit
      },
      { priority: telegramTdlibPriorities.maximum }
    )) as TelegramWireChats;
  } catch (error) {
    if (chatList === 'archive' && isTdlibNotFound(error)) {
      return [];
    }

    throw error;
  }

  return chats.chat_ids;
}

function toTdChatList(chatList: ChatListKind): TelegramWireObject {
  return chatList === 'main' ? { _: 'chatListMain' } : { _: 'chatListArchive' };
}

async function invokeTdlib(
  eventBus: EventBus,
  client: TelegramTdlibScheduler,
  request: TelegramWireObject,
  options: TdlibInvokeOptions = {}
): Promise<unknown> {
  for (;;) {
    try {
      return await invokeTdlibWithEvents(eventBus, client, request, {
        ...options
      });
    } catch (error) {
      const floodWaitSeconds = parseFloodWaitSeconds(error);
      if (floodWaitSeconds === undefined) {
        throw error;
      }

      console.warn(
        JSON.stringify({
          event: 'telegram.flood_wait',
          request: request._,
          seconds: floodWaitSeconds
        })
      );
      await delay((floodWaitSeconds + 1) * 1000);
    }
  }
}

function parseFloodWaitSeconds(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/.exec(message);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function runShutdownStep(name: string, step: () => Promise<void>): Promise<boolean> {
  try {
    await withTimeout(step(), TELEGRAM_SHUTDOWN_STEP_TIMEOUT_MS, name);
    return true;
  } catch (error) {
    console.warn(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'telegram.shutdown_step_failed',
        step: name
      })
    );
    return false;
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, name: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${name} timed out after ${String(milliseconds)}ms`));
        }, milliseconds);
        timeout.unref();
      })
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function waitForShutdown(close: () => Promise<boolean>): Promise<void> {
  await new Promise<void>((resolve) => {
    let shutdownStarted = false;
    const shutdown = (signal: NodeJS.Signals): void => {
      if (shutdownStarted) {
        console.warn(
          JSON.stringify({
            event: 'telegram.shutdown_repeated_signal',
            signal
          })
        );
        return;
      }

      shutdownStarted = true;
      console.log(
        JSON.stringify({
          event: 'telegram.shutdown_started',
          signal
        })
      );

      const forceExit = setTimeout(() => {
        console.error(
          JSON.stringify({
            event: 'telegram.shutdown_forced_exit',
            timeoutMs: TELEGRAM_SHUTDOWN_FORCE_EXIT_MS
          })
        );
        process.exit(130);
      }, TELEGRAM_SHUTDOWN_FORCE_EXIT_MS);
      forceExit.unref();

      void close()
        .then((clean) => {
          clearTimeout(forceExit);
          if (clean) {
            resolve();
            return;
          }
          console.warn(JSON.stringify({ event: 'telegram.shutdown_incomplete' }));
          process.exit(130);
        })
        .catch((error: unknown) => {
          clearTimeout(forceExit);
          console.error(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              event: 'telegram.shutdown_failed'
            })
          );
          process.exit(130);
        });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  });
}

function isTdlibLiveCoverageConnectionState(connectionState: string): boolean {
  return connectionState === 'connectionStateReady';
}

function summarizeCurrentUser(user: TelegramWireUser): Record<string, unknown> {
  return {
    id: String(user.id),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.usernames?.active_usernames[0],
    isPremium: user.is_premium
  };
}
