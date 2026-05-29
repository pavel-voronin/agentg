import type { Server } from 'node:http';
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
import { serviceManifestEventTypes } from '@agentg/framework/call-event-types';
import type { InternalTrpcBindConfig } from '@agentg/framework/config';
import type {
  DomainServiceManifest,
  DomainServiceManifestConfig,
  InternalRpcDomainServerOptions
} from '@agentg/framework/domain';
import {
  createTelegramClient,
  hasTelegramCredentials,
  type TelegramClientConfig
} from './client.js';
import {
  invokeTdlibWithEvents,
  type TdlibInvokeOptions,
  type TdlibInvoker,
  publishTdlibOperationEvents,
  publishTelegramOperationEvents
} from './operationEvents.js';
import { telegramTdlibPriorities } from './priority.js';
import {
  createTelegramFileSubsystem,
  useFiles,
  type TelegramFileSubsystem
} from '../files/subsystem.js';
import { createTelegramTdlibScheduler, type TelegramTdlibScheduler } from './scheduler.js';
import {
  createTelegramLiveCoverageObserver,
  type TelegramLiveCoverageObserver
} from '../history/liveCoverage.js';
import { useLiveCoverage } from '../history/subsystem.js';
import { createTelegramUpdateEventPublishers } from '../events/updateEventPublishers.js';
import { useUpdateEvents } from '../events/updateEvents.js';
import { useTelegramStatus, type TelegramStatusTracker } from '../status/subsystem.js';
import { handleUpdateAccentColors } from './update-handlers/updateAccentColors.js';
import { handleUpdateActiveEmojiReactions } from './update-handlers/updateActiveEmojiReactions.js';
import { handleUpdateActiveGiftAuctions } from './update-handlers/updateActiveGiftAuctions.js';
import { handleUpdateActiveLiveLocationMessages } from './update-handlers/updateActiveLiveLocationMessages.js';
import { handleUpdateActiveNotifications } from './update-handlers/updateActiveNotifications.js';
import { handleUpdateAgeVerificationParameters } from './update-handlers/updateAgeVerificationParameters.js';
import { handleUpdateAnimatedEmojiMessageClicked } from './update-handlers/updateAnimatedEmojiMessageClicked.js';
import { handleUpdateAnimationSearchParameters } from './update-handlers/updateAnimationSearchParameters.js';
import { handleUpdateApplicationRecaptchaVerificationRequired } from './update-handlers/updateApplicationRecaptchaVerificationRequired.js';
import { handleUpdateApplicationVerificationRequired } from './update-handlers/updateApplicationVerificationRequired.js';
import { handleUpdateAttachmentMenuBots } from './update-handlers/updateAttachmentMenuBots.js';
import { handleUpdateAuthorizationState } from './update-handlers/updateAuthorizationState.js';
import { handleUpdateAutosaveSettings } from './update-handlers/updateAutosaveSettings.js';
import { handleUpdateAvailableMessageEffects } from './update-handlers/updateAvailableMessageEffects.js';
import { handleUpdateBasicGroup } from './update-handlers/updateBasicGroup.js';
import { handleUpdateBasicGroupFullInfo } from './update-handlers/updateBasicGroupFullInfo.js';
import { handleUpdateBusinessConnection } from './update-handlers/updateBusinessConnection.js';
import { handleUpdateBusinessMessageEdited } from './update-handlers/updateBusinessMessageEdited.js';
import { handleUpdateBusinessMessagesDeleted } from './update-handlers/updateBusinessMessagesDeleted.js';
import { handleUpdateCall } from './update-handlers/updateCall.js';
import { handleUpdateChatAccentColors } from './update-handlers/updateChatAccentColors.js';
import { handleUpdateChatAction } from './update-handlers/updateChatAction.js';
import { handleUpdateChatActionBar } from './update-handlers/updateChatActionBar.js';
import { handleUpdateChatActiveStories } from './update-handlers/updateChatActiveStories.js';
import { handleUpdateChatAddedToList } from './update-handlers/updateChatAddedToList.js';
import { handleUpdateChatAvailableReactions } from './update-handlers/updateChatAvailableReactions.js';
import { handleUpdateChatBackground } from './update-handlers/updateChatBackground.js';
import { handleUpdateChatBlockList } from './update-handlers/updateChatBlockList.js';
import { handleUpdateChatBoost } from './update-handlers/updateChatBoost.js';
import { handleUpdateChatBusinessBotManageBar } from './update-handlers/updateChatBusinessBotManageBar.js';
import { handleUpdateChatDefaultDisableNotification } from './update-handlers/updateChatDefaultDisableNotification.js';
import { handleUpdateChatDraftMessage } from './update-handlers/updateChatDraftMessage.js';
import { handleUpdateChatEmojiStatus } from './update-handlers/updateChatEmojiStatus.js';
import { handleUpdateChatFolders } from './update-handlers/updateChatFolders.js';
import { handleUpdateChatHasProtectedContent } from './update-handlers/updateChatHasProtectedContent.js';
import { handleUpdateChatHasScheduledMessages } from './update-handlers/updateChatHasScheduledMessages.js';
import { handleUpdateChatIsMarkedAsUnread } from './update-handlers/updateChatIsMarkedAsUnread.js';
import { handleUpdateChatIsTranslatable } from './update-handlers/updateChatIsTranslatable.js';
import { handleUpdateChatLastMessage } from './update-handlers/updateChatLastMessage.js';
import { handleUpdateChatMember } from './update-handlers/updateChatMember.js';
import { handleUpdateChatMessageAutoDeleteTime } from './update-handlers/updateChatMessageAutoDeleteTime.js';
import { handleUpdateChatMessageSender } from './update-handlers/updateChatMessageSender.js';
import { handleUpdateChatNotificationSettings } from './update-handlers/updateChatNotificationSettings.js';
import { handleUpdateChatOnlineMemberCount } from './update-handlers/updateChatOnlineMemberCount.js';
import { handleUpdateChatPendingJoinRequests } from './update-handlers/updateChatPendingJoinRequests.js';
import { handleUpdateChatPermissions } from './update-handlers/updateChatPermissions.js';
import { handleUpdateChatPhoto } from './update-handlers/updateChatPhoto.js';
import { handleUpdateChatPosition } from './update-handlers/updateChatPosition.js';
import { handleUpdateChatReadInbox } from './update-handlers/updateChatReadInbox.js';
import { handleUpdateChatReadOutbox } from './update-handlers/updateChatReadOutbox.js';
import { handleUpdateChatRemovedFromList } from './update-handlers/updateChatRemovedFromList.js';
import { handleUpdateChatReplyMarkup } from './update-handlers/updateChatReplyMarkup.js';
import { handleUpdateChatRevenueAmount } from './update-handlers/updateChatRevenueAmount.js';
import { handleUpdateChatTheme } from './update-handlers/updateChatTheme.js';
import { handleUpdateChatTitle } from './update-handlers/updateChatTitle.js';
import { handleUpdateChatUnreadMentionCount } from './update-handlers/updateChatUnreadMentionCount.js';
import { handleUpdateChatUnreadPollVoteCount } from './update-handlers/updateChatUnreadPollVoteCount.js';
import { handleUpdateChatUnreadReactionCount } from './update-handlers/updateChatUnreadReactionCount.js';
import { handleUpdateChatVideoChat } from './update-handlers/updateChatVideoChat.js';
import { handleUpdateChatViewAsTopics } from './update-handlers/updateChatViewAsTopics.js';
import { handleUpdateConnectionState } from './update-handlers/updateConnectionState.js';
import { handleUpdateContactCloseBirthdays } from './update-handlers/updateContactCloseBirthdays.js';
import { handleUpdateDefaultBackground } from './update-handlers/updateDefaultBackground.js';
import { handleUpdateDefaultPaidReactionType } from './update-handlers/updateDefaultPaidReactionType.js';
import { handleUpdateDefaultReactionType } from './update-handlers/updateDefaultReactionType.js';
import { handleUpdateDeleteMessages } from './update-handlers/updateDeleteMessages.js';
import { handleUpdateDiceEmojis } from './update-handlers/updateDiceEmojis.js';
import { handleUpdateDirectMessagesChatTopic } from './update-handlers/updateDirectMessagesChatTopic.js';
import { handleUpdateEmojiChatThemes } from './update-handlers/updateEmojiChatThemes.js';
import { handleUpdateFavoriteStickers } from './update-handlers/updateFavoriteStickers.js';
import { handleUpdateFile } from './update-handlers/updateFile.js';
import { handleUpdateFileAddedToDownloads } from './update-handlers/updateFileAddedToDownloads.js';
import { handleUpdateFileDownload } from './update-handlers/updateFileDownload.js';
import { handleUpdateFileDownloads } from './update-handlers/updateFileDownloads.js';
import { handleUpdateFileGenerationStart } from './update-handlers/updateFileGenerationStart.js';
import { handleUpdateFileGenerationStop } from './update-handlers/updateFileGenerationStop.js';
import { handleUpdateFileRemovedFromDownloads } from './update-handlers/updateFileRemovedFromDownloads.js';
import { handleUpdateForumTopic } from './update-handlers/updateForumTopic.js';
import { handleUpdateForumTopicInfo } from './update-handlers/updateForumTopicInfo.js';
import { handleUpdateFreezeState } from './update-handlers/updateFreezeState.js';
import { handleUpdateGiftAuctionState } from './update-handlers/updateGiftAuctionState.js';
import { handleUpdateGroupCall } from './update-handlers/updateGroupCall.js';
import { handleUpdateGroupCallMessageLevels } from './update-handlers/updateGroupCallMessageLevels.js';
import { handleUpdateGroupCallMessageSendFailed } from './update-handlers/updateGroupCallMessageSendFailed.js';
import { handleUpdateGroupCallMessagesDeleted } from './update-handlers/updateGroupCallMessagesDeleted.js';
import { handleUpdateGroupCallParticipant } from './update-handlers/updateGroupCallParticipant.js';
import { handleUpdateGroupCallParticipants } from './update-handlers/updateGroupCallParticipants.js';
import { handleUpdateGroupCallVerificationState } from './update-handlers/updateGroupCallVerificationState.js';
import { handleUpdateHavePendingNotifications } from './update-handlers/updateHavePendingNotifications.js';
import { handleUpdateInstalledStickerSets } from './update-handlers/updateInstalledStickerSets.js';
import { handleUpdateLanguagePackStrings } from './update-handlers/updateLanguagePackStrings.js';
import { handleUpdateLiveStoryTopDonors } from './update-handlers/updateLiveStoryTopDonors.js';
import { handleUpdateManagedBot } from './update-handlers/updateManagedBot.js';
import { handleUpdateMessageContainsUnreadPollVotes } from './update-handlers/updateMessageContainsUnreadPollVotes.js';
import { handleUpdateMessageContent } from './update-handlers/updateMessageContent.js';
import { handleUpdateMessageContentOpened } from './update-handlers/updateMessageContentOpened.js';
import { handleUpdateMessageEdited } from './update-handlers/updateMessageEdited.js';
import { handleUpdateMessageFactCheck } from './update-handlers/updateMessageFactCheck.js';
import { handleUpdateMessageInteractionInfo } from './update-handlers/updateMessageInteractionInfo.js';
import { handleUpdateMessageIsPinned } from './update-handlers/updateMessageIsPinned.js';
import { handleUpdateMessageLiveLocationViewed } from './update-handlers/updateMessageLiveLocationViewed.js';
import { handleUpdateMessageMentionRead } from './update-handlers/updateMessageMentionRead.js';
import { handleUpdateMessageReaction } from './update-handlers/updateMessageReaction.js';
import { handleUpdateMessageReactions } from './update-handlers/updateMessageReactions.js';
import { handleUpdateMessageSendAcknowledged } from './update-handlers/updateMessageSendAcknowledged.js';
import { handleUpdateMessageSendFailed } from './update-handlers/updateMessageSendFailed.js';
import { handleUpdateMessageSendSucceeded } from './update-handlers/updateMessageSendSucceeded.js';
import { handleUpdateMessageSuggestedPostInfo } from './update-handlers/updateMessageSuggestedPostInfo.js';
import { handleUpdateMessageUnreadReactions } from './update-handlers/updateMessageUnreadReactions.js';
import { handleUpdateNewBusinessCallbackQuery } from './update-handlers/updateNewBusinessCallbackQuery.js';
import { handleUpdateNewBusinessMessage } from './update-handlers/updateNewBusinessMessage.js';
import { handleUpdateNewCallbackQuery } from './update-handlers/updateNewCallbackQuery.js';
import { handleUpdateNewCallSignalingData } from './update-handlers/updateNewCallSignalingData.js';
import { handleUpdateNewChatJoinRequest } from './update-handlers/updateNewChatJoinRequest.js';
import { handleUpdateNewChat } from './update-handlers/updateNewChat.js';
import { handleUpdateNewChosenInlineResult } from './update-handlers/updateNewChosenInlineResult.js';
import { handleUpdateNewCustomEvent } from './update-handlers/updateNewCustomEvent.js';
import { handleUpdateNewCustomQuery } from './update-handlers/updateNewCustomQuery.js';
import { handleUpdateNewGuestQuery } from './update-handlers/updateNewGuestQuery.js';
import { handleUpdateNewGroupCallMessage } from './update-handlers/updateNewGroupCallMessage.js';
import { handleUpdateNewGroupCallPaidReaction } from './update-handlers/updateNewGroupCallPaidReaction.js';
import { handleUpdateNewInlineCallbackQuery } from './update-handlers/updateNewInlineCallbackQuery.js';
import { handleUpdateNewInlineQuery } from './update-handlers/updateNewInlineQuery.js';
import { handleUpdateNewMessage } from './update-handlers/updateNewMessage.js';
import { handleUpdateNewOauthRequest } from './update-handlers/updateNewOauthRequest.js';
import { handleUpdateNewPreCheckoutQuery } from './update-handlers/updateNewPreCheckoutQuery.js';
import { handleUpdateNewShippingQuery } from './update-handlers/updateNewShippingQuery.js';
import { handleUpdateNotification } from './update-handlers/updateNotification.js';
import { handleUpdateNotificationGroup } from './update-handlers/updateNotificationGroup.js';
import { handleUpdateOption } from './update-handlers/updateOption.js';
import { handleUpdateOwnedStarCount } from './update-handlers/updateOwnedStarCount.js';
import { handleUpdateOwnedTonCount } from './update-handlers/updateOwnedTonCount.js';
import { handleUpdatePaidMediaPurchased } from './update-handlers/updatePaidMediaPurchased.js';
import { handleUpdatePendingTextMessage } from './update-handlers/updatePendingTextMessage.js';
import { handleUpdatePoll } from './update-handlers/updatePoll.js';
import { handleUpdatePollAnswer } from './update-handlers/updatePollAnswer.js';
import { handleUpdateProfileAccentColors } from './update-handlers/updateProfileAccentColors.js';
import { handleUpdateQuickReplyShortcut } from './update-handlers/updateQuickReplyShortcut.js';
import { handleUpdateQuickReplyShortcutDeleted } from './update-handlers/updateQuickReplyShortcutDeleted.js';
import { handleUpdateQuickReplyShortcutMessages } from './update-handlers/updateQuickReplyShortcutMessages.js';
import { handleUpdateQuickReplyShortcuts } from './update-handlers/updateQuickReplyShortcuts.js';
import { handleUpdateReactionNotificationSettings } from './update-handlers/updateReactionNotificationSettings.js';
import { handleUpdateRecentStickers } from './update-handlers/updateRecentStickers.js';
import { handleUpdateSavedAnimations } from './update-handlers/updateSavedAnimations.js';
import { handleUpdateSavedMessagesTags } from './update-handlers/updateSavedMessagesTags.js';
import { handleUpdateSavedMessagesTopic } from './update-handlers/updateSavedMessagesTopic.js';
import { handleUpdateSavedMessagesTopicCount } from './update-handlers/updateSavedMessagesTopicCount.js';
import { handleUpdateSavedNotificationSounds } from './update-handlers/updateSavedNotificationSounds.js';
import { handleUpdateScopeNotificationSettings } from './update-handlers/updateScopeNotificationSettings.js';
import { handleUpdateSecretChat } from './update-handlers/updateSecretChat.js';
import { handleUpdateServiceNotification } from './update-handlers/updateServiceNotification.js';
import { handleUpdateSpeechRecognitionTrial } from './update-handlers/updateSpeechRecognitionTrial.js';
import { handleUpdateSpeedLimitNotification } from './update-handlers/updateSpeedLimitNotification.js';
import { handleUpdateStakeDiceState } from './update-handlers/updateStakeDiceState.js';
import { handleUpdateStarRevenueStatus } from './update-handlers/updateStarRevenueStatus.js';
import { handleUpdateStickerSet } from './update-handlers/updateStickerSet.js';
import { handleUpdateStory } from './update-handlers/updateStory.js';
import { handleUpdateStoryDeleted } from './update-handlers/updateStoryDeleted.js';
import { handleUpdateStoryListChatCount } from './update-handlers/updateStoryListChatCount.js';
import { handleUpdateStoryPostFailed } from './update-handlers/updateStoryPostFailed.js';
import { handleUpdateStoryPostSucceeded } from './update-handlers/updateStoryPostSucceeded.js';
import { handleUpdateStoryStealthMode } from './update-handlers/updateStoryStealthMode.js';
import { handleUpdateSuggestedActions } from './update-handlers/updateSuggestedActions.js';
import { handleUpdateSupergroup } from './update-handlers/updateSupergroup.js';
import { handleUpdateSupergroupFullInfo } from './update-handlers/updateSupergroupFullInfo.js';
import { handleUpdateTermsOfService } from './update-handlers/updateTermsOfService.js';
import { handleUpdateTextCompositionStyles } from './update-handlers/updateTextCompositionStyles.js';
import { handleUpdateTonRevenueStatus } from './update-handlers/updateTonRevenueStatus.js';
import { handleUpdateTopicMessageCount } from './update-handlers/updateTopicMessageCount.js';
import { handleUpdateTrendingStickerSets } from './update-handlers/updateTrendingStickerSets.js';
import { handleUpdateTrustedMiniAppBots } from './update-handlers/updateTrustedMiniAppBots.js';
import { handleUpdateUnconfirmedSession } from './update-handlers/updateUnconfirmedSession.js';
import { handleUpdateUnreadChatCount } from './update-handlers/updateUnreadChatCount.js';
import { handleUpdateUnreadMessageCount } from './update-handlers/updateUnreadMessageCount.js';
import { handleUpdateUser } from './update-handlers/updateUser.js';
import { handleUpdateUserFullInfo } from './update-handlers/updateUserFullInfo.js';
import { handleUpdateUserPrivacySettingRules } from './update-handlers/updateUserPrivacySettingRules.js';
import { handleUpdateUserStatus } from './update-handlers/updateUserStatus.js';
import { handleUpdateVideoPublished } from './update-handlers/updateVideoPublished.js';
import { handleUpdateWebAppMessageSent } from './update-handlers/updateWebAppMessageSent.js';
import { recordChatFiles, storeChat } from '../store/chat.js';
import { recordMessageFiles, storeMessage } from '../store/message.js';
import { storeUser } from '../store/user.js';
import type {
  TelegramWireChat,
  TelegramWireChats,
  TelegramWireObject,
  TelegramWireUpdate,
  TelegramWireUser
} from './wire.js';

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

type TelegramIngestionRpcDeps = {
  client: TdlibInvoker;
  database: AppDatabase;
  eventBus: EventBus;
  files: TelegramFileSubsystem;
};

export type TelegramIngestionDomain = {
  createServiceManifest(config: DomainServiceManifestConfig): DomainServiceManifest<unknown>;
  startRpcServer(
    serverOptions: InternalRpcDomainServerOptions<TelegramIngestionRpcDeps>
  ): Promise<Server>;
  stopRpcServer(server: Server): Promise<void>;
};

type TelegramIngestionHooks = {
  configureOperations(deps: { client: TdlibInvoker; eventBus: EventBus }): void;
};

type TelegramClient = Awaited<ReturnType<typeof createTelegramClient>>;

type ChatListKind = 'main' | 'archive';

type TdlibStatusState = {
  authenticated: boolean;
  connected: boolean;
};

const TDLIB_STATUS_HEARTBEAT_MS = 5000;
const TELEGRAM_LIVE_COVERAGE_TICK_MS = 30_000;
const TELEGRAM_SHUTDOWN_FORCE_EXIT_MS = 4500;
const TELEGRAM_SHUTDOWN_STEP_TIMEOUT_MS = 2000;
const TELEGRAM_CONTROL_PLANE_ASSETS_ROOT = fileURLToPath(
  new URL('../../dist-control-plane/', import.meta.url)
);

export async function runTelegramIngestion(
  options: TelegramIngestionOptions,
  domain: TelegramIngestionDomain,
  hooks: TelegramIngestionHooks
): Promise<void> {
  const initialControlPlaneAssets = await readControlPlaneAssetVersions(
    TELEGRAM_CONTROL_PLANE_ASSETS_ROOT
  );
  const serviceManifest = domain.createServiceManifest({
    controlPlaneAssetVersion: initialControlPlaneAssets.version,
    controlPlaneAssetVersions: initialControlPlaneAssets.assets,
    rpcUrl: options.serviceRpcUrl
  });
  const eventBus = createValidatedEventBus(options.eventBus, {
    allowedTypes: serviceManifestEventTypes(serviceManifest),
    publisher: 'telegram'
  });
  let telegramRpcServer: Awaited<ReturnType<TelegramIngestionDomain['startRpcServer']>> | undefined;
  let controlPlaneAssets: ControlPlaneAssetVersionSubscription | undefined;
  let serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  let tdlibStatusHeartbeat: ReturnType<typeof setInterval> | undefined;
  let fileSubsystem: TelegramFileSubsystem | undefined;
  let liveCoverageObserver: TelegramLiveCoverageObserver | undefined;
  let liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  let tdlibScheduler: TelegramTdlibScheduler | undefined;
  let client: TelegramClient | undefined;
  let tdlibStatus: TelegramStatusTracker | undefined;
  let startupComplete = false;

  try {
    if (!hasTelegramCredentials(options.telegram)) {
      throw new Error('Telegram ingestion requires TELEGRAM_API_ID and TELEGRAM_API_HASH');
    }

    client = await createTelegramClient(options.telegram);
    const activeClient = client;
    tdlibScheduler = createTelegramTdlibScheduler(activeClient);
    const activeTdlibScheduler = tdlibScheduler;
    hooks.configureOperations({
      client: activeTdlibScheduler,
      eventBus
    });
    fileSubsystem = createTelegramFileSubsystem({
      client: activeTdlibScheduler,
      database: options.database,
      eventBus,
      filesDirectory: options.telegram.filesDirectory
    });
    const activeFileSubsystem = fileSubsystem;
    useFiles().configure(activeFileSubsystem);
    const updateEventPublishers = createTelegramUpdateEventPublishers(eventBus, options.database);
    useUpdateEvents().configure(updateEventPublishers);
    tdlibStatus = createTelegramStatusTracker(eventBus);
    const activeTdlibStatus = tdlibStatus;
    useTelegramStatus().configure(activeTdlibStatus);
    liveCoverageObserver = createTelegramLiveCoverageObserver({
      database: options.database
    });
    const activeLiveCoverageObserver = liveCoverageObserver;
    useLiveCoverage().configure(activeLiveCoverageObserver);

    activeClient.on('error', (error: unknown) => {
      console.error(JSON.stringify({ event: 'telegram.error', error: String(error) }));
    });
    activeClient.on('update', (update) => {
      void persistLiveUpdate(update);
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

    telegramRpcServer = await domain.startRpcServer({
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
          domain.createServiceManifest({
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
              domain.stopRpcServer(activeTelegramRpcServer)
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
        domain,
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
  tdlibStatus: TelegramStatusTracker | undefined;
  tdlibScheduler: TelegramTdlibScheduler | undefined;
  tdlibStatusHeartbeat: ReturnType<typeof setInterval> | undefined;
  domain: TelegramIngestionDomain;
  telegramRpcServer: Awaited<ReturnType<TelegramIngestionDomain['startRpcServer']>> | undefined;
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
      options.domain.stopRpcServer(telegramRpcServer)
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

function startTdlibStatusHeartbeat(status: TelegramStatusTracker): ReturnType<typeof setInterval> {
  status.publish();
  return setInterval(() => {
    status.publish();
  }, TDLIB_STATUS_HEARTBEAT_MS);
}

function createTelegramStatusTracker(eventBus: EventBus): TelegramStatusTracker {
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

async function persistLiveUpdate(update: TelegramWireUpdate): Promise<void> {
  switch (update._) {
    case 'updateAccentColors':
      await handleUpdateAccentColors(update);
      return;
    case 'updateActiveEmojiReactions':
      await handleUpdateActiveEmojiReactions(update);
      return;
    case 'updateActiveGiftAuctions':
      await handleUpdateActiveGiftAuctions(update);
      return;
    case 'updateActiveLiveLocationMessages':
      await handleUpdateActiveLiveLocationMessages(update);
      return;
    case 'updateActiveNotifications':
      await handleUpdateActiveNotifications(update);
      return;
    case 'updateAgeVerificationParameters':
      await handleUpdateAgeVerificationParameters(update);
      return;
    case 'updateAnimatedEmojiMessageClicked':
      await handleUpdateAnimatedEmojiMessageClicked(update);
      return;
    case 'updateAnimationSearchParameters':
      await handleUpdateAnimationSearchParameters(update);
      return;
    case 'updateApplicationRecaptchaVerificationRequired':
      handleUpdateApplicationRecaptchaVerificationRequired(update);
      return;
    case 'updateApplicationVerificationRequired':
      handleUpdateApplicationVerificationRequired(update);
      return;
    case 'updateAttachmentMenuBots':
      await handleUpdateAttachmentMenuBots(update);
      return;
    case 'updateAuthorizationState':
      await handleUpdateAuthorizationState(update);
      return;
    case 'updateAutosaveSettings':
      await handleUpdateAutosaveSettings(update);
      return;
    case 'updateAvailableMessageEffects':
      await handleUpdateAvailableMessageEffects(update);
      return;
    case 'updateBasicGroup':
      await handleUpdateBasicGroup(update);
      return;
    case 'updateBasicGroupFullInfo':
      await handleUpdateBasicGroupFullInfo(update);
      return;
    case 'updateBusinessConnection':
      await handleUpdateBusinessConnection(update);
      return;
    case 'updateBusinessMessageEdited':
      await handleUpdateBusinessMessageEdited(update);
      return;
    case 'updateBusinessMessagesDeleted':
      await handleUpdateBusinessMessagesDeleted(update);
      return;
    case 'updateCall':
      await handleUpdateCall(update);
      return;
    case 'updateChatAccentColors':
      await handleUpdateChatAccentColors(update);
      return;
    case 'updateChatAction':
      handleUpdateChatAction(update);
      return;
    case 'updateChatActionBar':
      await handleUpdateChatActionBar(update);
      return;
    case 'updateChatActiveStories':
      await handleUpdateChatActiveStories(update);
      return;
    case 'updateChatAddedToList':
      await handleUpdateChatAddedToList(update);
      return;
    case 'updateChatAvailableReactions':
      await handleUpdateChatAvailableReactions(update);
      return;
    case 'updateChatBackground':
      await handleUpdateChatBackground(update);
      return;
    case 'updateChatBlockList':
      await handleUpdateChatBlockList(update);
      return;
    case 'updateChatBoost':
      await handleUpdateChatBoost(update);
      return;
    case 'updateChatBusinessBotManageBar':
      await handleUpdateChatBusinessBotManageBar(update);
      return;
    case 'updateChatDefaultDisableNotification':
      await handleUpdateChatDefaultDisableNotification(update);
      return;
    case 'updateChatDraftMessage':
      await handleUpdateChatDraftMessage(update);
      return;
    case 'updateChatEmojiStatus':
      await handleUpdateChatEmojiStatus(update);
      return;
    case 'updateChatFolders':
      await handleUpdateChatFolders(update);
      return;
    case 'updateChatHasProtectedContent':
      await handleUpdateChatHasProtectedContent(update);
      return;
    case 'updateChatHasScheduledMessages':
      await handleUpdateChatHasScheduledMessages(update);
      return;
    case 'updateChatIsMarkedAsUnread':
      await handleUpdateChatIsMarkedAsUnread(update);
      return;
    case 'updateChatIsTranslatable':
      await handleUpdateChatIsTranslatable(update);
      return;
    case 'updateChatLastMessage':
      await handleUpdateChatLastMessage(update);
      return;
    case 'updateChatMember':
      await handleUpdateChatMember(update);
      return;
    case 'updateChatMessageAutoDeleteTime':
      await handleUpdateChatMessageAutoDeleteTime(update);
      return;
    case 'updateChatMessageSender':
      await handleUpdateChatMessageSender(update);
      return;
    case 'updateChatNotificationSettings':
      await handleUpdateChatNotificationSettings(update);
      return;
    case 'updateChatOnlineMemberCount':
      handleUpdateChatOnlineMemberCount(update);
      return;
    case 'updateChatPendingJoinRequests':
      await handleUpdateChatPendingJoinRequests(update);
      return;
    case 'updateChatPermissions':
      await handleUpdateChatPermissions(update);
      return;
    case 'updateChatPhoto':
      await handleUpdateChatPhoto(update);
      return;
    case 'updateChatPosition':
      await handleUpdateChatPosition(update);
      return;
    case 'updateChatReadInbox':
      await handleUpdateChatReadInbox(update);
      return;
    case 'updateChatReadOutbox':
      await handleUpdateChatReadOutbox(update);
      return;
    case 'updateChatRemovedFromList':
      await handleUpdateChatRemovedFromList(update);
      return;
    case 'updateChatReplyMarkup':
      await handleUpdateChatReplyMarkup(update);
      return;
    case 'updateChatRevenueAmount':
      await handleUpdateChatRevenueAmount(update);
      return;
    case 'updateChatTheme':
      await handleUpdateChatTheme(update);
      return;
    case 'updateChatTitle':
      await handleUpdateChatTitle(update);
      return;
    case 'updateChatUnreadMentionCount':
      await handleUpdateChatUnreadMentionCount(update);
      return;
    case 'updateChatUnreadPollVoteCount':
      await handleUpdateChatUnreadPollVoteCount(update);
      return;
    case 'updateChatUnreadReactionCount':
      await handleUpdateChatUnreadReactionCount(update);
      return;
    case 'updateChatVideoChat':
      await handleUpdateChatVideoChat(update);
      return;
    case 'updateChatViewAsTopics':
      await handleUpdateChatViewAsTopics(update);
      return;
    case 'updateConnectionState':
      await handleUpdateConnectionState(update);
      return;
    case 'updateContactCloseBirthdays':
      await handleUpdateContactCloseBirthdays(update);
      return;
    case 'updateDefaultBackground':
      await handleUpdateDefaultBackground(update);
      return;
    case 'updateDefaultPaidReactionType':
      await handleUpdateDefaultPaidReactionType(update);
      return;
    case 'updateDefaultReactionType':
      await handleUpdateDefaultReactionType(update);
      return;
    case 'updateDeleteMessages':
      await handleUpdateDeleteMessages(update);
      return;
    case 'updateDiceEmojis':
      await handleUpdateDiceEmojis(update);
      return;
    case 'updateDirectMessagesChatTopic':
      await handleUpdateDirectMessagesChatTopic(update);
      return;
    case 'updateEmojiChatThemes':
      await handleUpdateEmojiChatThemes(update);
      return;
    case 'updateFavoriteStickers':
      await handleUpdateFavoriteStickers(update);
      return;
    case 'updateFile':
      await handleUpdateFile(update);
      return;
    case 'updateFileAddedToDownloads':
      await handleUpdateFileAddedToDownloads(update);
      return;
    case 'updateFileDownload':
      await handleUpdateFileDownload(update);
      return;
    case 'updateFileDownloads':
      await handleUpdateFileDownloads(update);
      return;
    case 'updateFileGenerationStart':
      await handleUpdateFileGenerationStart(update);
      return;
    case 'updateFileGenerationStop':
      await handleUpdateFileGenerationStop(update);
      return;
    case 'updateFileRemovedFromDownloads':
      await handleUpdateFileRemovedFromDownloads(update);
      return;
    case 'updateForumTopic':
      await handleUpdateForumTopic(update);
      return;
    case 'updateForumTopicInfo':
      await handleUpdateForumTopicInfo(update);
      return;
    case 'updateFreezeState':
      await handleUpdateFreezeState(update);
      return;
    case 'updateGiftAuctionState':
      await handleUpdateGiftAuctionState(update);
      return;
    case 'updateGroupCall':
      await handleUpdateGroupCall(update);
      return;
    case 'updateGroupCallMessageLevels':
      await handleUpdateGroupCallMessageLevels(update);
      return;
    case 'updateGroupCallMessageSendFailed':
      await handleUpdateGroupCallMessageSendFailed(update);
      return;
    case 'updateGroupCallMessagesDeleted':
      await handleUpdateGroupCallMessagesDeleted(update);
      return;
    case 'updateGroupCallParticipant':
      await handleUpdateGroupCallParticipant(update);
      return;
    case 'updateGroupCallParticipants':
      await handleUpdateGroupCallParticipants(update);
      return;
    case 'updateGroupCallVerificationState':
      await handleUpdateGroupCallVerificationState(update);
      return;
    case 'updateHavePendingNotifications':
      handleUpdateHavePendingNotifications(update);
      return;
    case 'updateInstalledStickerSets':
      await handleUpdateInstalledStickerSets(update);
      return;
    case 'updateLanguagePackStrings':
      await handleUpdateLanguagePackStrings(update);
      return;
    case 'updateLiveStoryTopDonors':
      await handleUpdateLiveStoryTopDonors(update);
      return;
    case 'updateManagedBot':
      await handleUpdateManagedBot(update);
      return;
    case 'updateMessageContainsUnreadPollVotes':
      await handleUpdateMessageContainsUnreadPollVotes(update);
      return;
    case 'updateMessageContent':
      await handleUpdateMessageContent(update);
      return;
    case 'updateMessageContentOpened':
      await handleUpdateMessageContentOpened(update);
      return;
    case 'updateMessageEdited':
      await handleUpdateMessageEdited(update);
      return;
    case 'updateMessageFactCheck':
      await handleUpdateMessageFactCheck(update);
      return;
    case 'updateMessageInteractionInfo':
      await handleUpdateMessageInteractionInfo(update);
      return;
    case 'updateMessageIsPinned':
      await handleUpdateMessageIsPinned(update);
      return;
    case 'updateMessageLiveLocationViewed':
      handleUpdateMessageLiveLocationViewed(update);
      return;
    case 'updateMessageMentionRead':
      await handleUpdateMessageMentionRead(update);
      return;
    case 'updateMessageReaction':
      await handleUpdateMessageReaction(update);
      return;
    case 'updateMessageReactions':
      await handleUpdateMessageReactions(update);
      return;
    case 'updateMessageSendAcknowledged':
      await handleUpdateMessageSendAcknowledged(update);
      return;
    case 'updateMessageSendFailed':
      await handleUpdateMessageSendFailed(update);
      return;
    case 'updateMessageSendSucceeded':
      await handleUpdateMessageSendSucceeded(update);
      return;
    case 'updateMessageSuggestedPostInfo':
      await handleUpdateMessageSuggestedPostInfo(update);
      return;
    case 'updateMessageUnreadReactions':
      await handleUpdateMessageUnreadReactions(update);
      return;
    case 'updateNewBusinessCallbackQuery':
      await handleUpdateNewBusinessCallbackQuery(update);
      return;
    case 'updateNewBusinessMessage':
      await handleUpdateNewBusinessMessage(update);
      return;
    case 'updateNewCallbackQuery':
      handleUpdateNewCallbackQuery(update);
      return;
    case 'updateNewCallSignalingData':
      handleUpdateNewCallSignalingData(update);
      return;
    case 'updateNewChatJoinRequest':
      await handleUpdateNewChatJoinRequest(update);
      return;
    case 'updateNewChat':
      await handleUpdateNewChat(update);
      return;
    case 'updateNewChosenInlineResult':
      handleUpdateNewChosenInlineResult(update);
      return;
    case 'updateNewCustomEvent':
      handleUpdateNewCustomEvent(update);
      return;
    case 'updateNewCustomQuery':
      handleUpdateNewCustomQuery(update);
      return;
    case 'updateNewGuestQuery':
      await handleUpdateNewGuestQuery(update);
      return;
    case 'updateNewGroupCallMessage':
      await handleUpdateNewGroupCallMessage(update);
      return;
    case 'updateNewGroupCallPaidReaction':
      handleUpdateNewGroupCallPaidReaction(update);
      return;
    case 'updateNewInlineCallbackQuery':
      handleUpdateNewInlineCallbackQuery(update);
      return;
    case 'updateNewInlineQuery':
      handleUpdateNewInlineQuery(update);
      return;
    case 'updateNewMessage':
      await handleUpdateNewMessage(update);
      return;
    case 'updateNewOauthRequest':
      handleUpdateNewOauthRequest(update);
      return;
    case 'updateNewPreCheckoutQuery':
      handleUpdateNewPreCheckoutQuery(update);
      return;
    case 'updateNewShippingQuery':
      handleUpdateNewShippingQuery(update);
      return;
    case 'updateNotification':
      await handleUpdateNotification(update);
      return;
    case 'updateNotificationGroup':
      await handleUpdateNotificationGroup(update);
      return;
    case 'updateOption':
      await handleUpdateOption(update);
      return;
    case 'updateOwnedStarCount':
      await handleUpdateOwnedStarCount(update);
      return;
    case 'updateOwnedTonCount':
      await handleUpdateOwnedTonCount(update);
      return;
    case 'updatePaidMediaPurchased':
      handleUpdatePaidMediaPurchased(update);
      return;
    case 'updatePendingTextMessage':
      handleUpdatePendingTextMessage(update);
      return;
    case 'updatePoll':
      await handleUpdatePoll(update);
      return;
    case 'updatePollAnswer':
      await handleUpdatePollAnswer(update);
      return;
    case 'updateProfileAccentColors':
      await handleUpdateProfileAccentColors(update);
      return;
    case 'updateQuickReplyShortcut':
      await handleUpdateQuickReplyShortcut(update);
      return;
    case 'updateQuickReplyShortcutDeleted':
      await handleUpdateQuickReplyShortcutDeleted(update);
      return;
    case 'updateQuickReplyShortcutMessages':
      await handleUpdateQuickReplyShortcutMessages(update);
      return;
    case 'updateQuickReplyShortcuts':
      await handleUpdateQuickReplyShortcuts(update);
      return;
    case 'updateReactionNotificationSettings':
      await handleUpdateReactionNotificationSettings(update);
      return;
    case 'updateRecentStickers':
      await handleUpdateRecentStickers(update);
      return;
    case 'updateSavedAnimations':
      await handleUpdateSavedAnimations(update);
      return;
    case 'updateSavedMessagesTags':
      await handleUpdateSavedMessagesTags(update);
      return;
    case 'updateSavedMessagesTopic':
      await handleUpdateSavedMessagesTopic(update);
      return;
    case 'updateSavedMessagesTopicCount':
      await handleUpdateSavedMessagesTopicCount(update);
      return;
    case 'updateSavedNotificationSounds':
      await handleUpdateSavedNotificationSounds(update);
      return;
    case 'updateScopeNotificationSettings':
      await handleUpdateScopeNotificationSettings(update);
      return;
    case 'updateSecretChat':
      await handleUpdateSecretChat(update);
      return;
    case 'updateServiceNotification':
      await handleUpdateServiceNotification(update);
      return;
    case 'updateSpeechRecognitionTrial':
      await handleUpdateSpeechRecognitionTrial(update);
      return;
    case 'updateSpeedLimitNotification':
      await handleUpdateSpeedLimitNotification(update);
      return;
    case 'updateStakeDiceState':
      await handleUpdateStakeDiceState(update);
      return;
    case 'updateStarRevenueStatus':
      await handleUpdateStarRevenueStatus(update);
      return;
    case 'updateStickerSet':
      await handleUpdateStickerSet(update);
      return;
    case 'updateStory':
      await handleUpdateStory(update);
      return;
    case 'updateStoryDeleted':
      await handleUpdateStoryDeleted(update);
      return;
    case 'updateStoryListChatCount':
      await handleUpdateStoryListChatCount(update);
      return;
    case 'updateStoryPostFailed':
      await handleUpdateStoryPostFailed(update);
      return;
    case 'updateStoryPostSucceeded':
      await handleUpdateStoryPostSucceeded(update);
      return;
    case 'updateStoryStealthMode':
      await handleUpdateStoryStealthMode(update);
      return;
    case 'updateSuggestedActions':
      await handleUpdateSuggestedActions(update);
      return;
    case 'updateSupergroup':
      await handleUpdateSupergroup(update);
      return;
    case 'updateSupergroupFullInfo':
      await handleUpdateSupergroupFullInfo(update);
      return;
    case 'updateTermsOfService':
      await handleUpdateTermsOfService(update);
      return;
    case 'updateTextCompositionStyles':
      await handleUpdateTextCompositionStyles(update);
      return;
    case 'updateTonRevenueStatus':
      await handleUpdateTonRevenueStatus(update);
      return;
    case 'updateTopicMessageCount':
      await handleUpdateTopicMessageCount(update);
      return;
    case 'updateTrendingStickerSets':
      await handleUpdateTrendingStickerSets(update);
      return;
    case 'updateTrustedMiniAppBots':
      await handleUpdateTrustedMiniAppBots(update);
      return;
    case 'updateUnconfirmedSession':
      await handleUpdateUnconfirmedSession(update);
      return;
    case 'updateUnreadChatCount':
      await handleUpdateUnreadChatCount(update);
      return;
    case 'updateUnreadMessageCount':
      await handleUpdateUnreadMessageCount(update);
      return;
    case 'updateUser':
      await handleUpdateUser(update);
      return;
    case 'updateUserFullInfo':
      await handleUpdateUserFullInfo(update);
      return;
    case 'updateUserPrivacySettingRules':
      await handleUpdateUserPrivacySettingRules(update);
      return;
    case 'updateUserStatus':
      await handleUpdateUserStatus(update);
      return;
    case 'updateVideoPublished':
      await handleUpdateVideoPublished(update);
      return;
    case 'updateWebAppMessageSent':
      await handleUpdateWebAppMessageSent(update);
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
