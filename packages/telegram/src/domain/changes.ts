import type { TelegramPayload } from './models/payload.js';

import type { ChatModelRef, MessageModelRef } from '../model/refs.js';
import type {
  ActiveNotificationGroupUpdate,
  ActiveNotification,
  ActiveNotificationSnapshot
} from './models/activeNotification.js';
import type { AttachmentMenuBot } from './models/attachmentMenuBot.js';
import type { Background } from './models/background.js';
import type { BusinessMessageState } from './models/businessMessage.js';
import type {
  ChatListMembership,
  ChatPositionState,
  ChatState,
  ChatPatch
} from './models/chatState.js';
import type { ChatFolderInfo } from './models/chatFolder.js';
import type { ChatInviteLink, ChatJoinRequest, ChatMember } from './models/chatMember.js';
import type { ChatPhoto } from './models/chatPhoto.js';
import type { UserState, UserPatch } from './models/user.js';
import type { FileState } from './models/fileState.js';
import type { BusinessConnection } from './models/businessConnection.js';
import type { Call } from './models/call.js';
import type { FileDownloadPatch, FileDownload } from './models/fileDownload.js';
import type { BasicGroup, BasicGroupPatch, Supergroup, SupergroupPatch } from './models/group.js';
import type { GiftAuction, GiftAuctionState, Gift, UpgradedGift } from './models/gift.js';
import type { KvEntry } from './models/kvEntry.js';
import type { Message } from './models/message.js';
import type { MessageState, MessagePatch } from './models/messageState.js';
import type { PollAnswerOption, PollOption, Poll } from './models/poll.js';
import type {
  MessageReactionSender,
  MessageReactionType,
  MessageReactionSummary
} from './models/messageReactionState.js';
import type { QuickReplyMessageState, QuickReplyShortcut } from './models/quickReply.js';
import type {
  ForumTopicInfo,
  ForumTopic,
  GroupCallEncryptedParticipantUsers,
  GroupCallMessageState,
  GroupCallParticipant,
  GroupCall,
  GroupCallVerificationState,
  LanguagePackString,
  LiveStoryDonors,
  ManagedBot
} from './models/runtimeState.js';
import type { SecretChatState } from './models/secretChat.js';
import type {
  AutosaveSettings,
  NotificationSettings,
  TermsOfService,
  UserPrivacySettingRules
} from './models/settings.js';
import type { StarRevenueStatus } from './models/starRevenue.js';
import type {
  ChatActiveStories,
  ChatBoost,
  ChatRevenueAmount,
  ContactCloseBirthday,
  FileGenerationRequest,
  TextCompositionStyle
} from './models/state.js';
import type { StoryIdentity, StoryState } from './models/story.js';
import type { Sticker, StickerSet } from './models/sticker.js';
import type { SuggestedAction } from './models/suggestedAction.js';
import type {
  DirectMessagesChatTopic,
  SavedMessagesTag,
  SavedMessagesTopic
} from './models/topic.js';

export type DomainChange =
  | ActiveNotificationGroupUpdatedChange
  | ActiveNotificationSnapshotReplacedChange
  | ActiveNotificationUpsertedChange
  | ActiveLiveLocationMessagesReplacedChange
  | AttachmentMenuBotsReplacedChange
  | AutosaveSettingsDeletedChange
  | AutosaveSettingsSavedChange
  | BasicGroupFullInfoSavedChange
  | BasicGroupSavedChange
  | BusinessConnectionSavedChange
  | BusinessMessageCreatedChange
  | BusinessMessagesDeletedChange
  | BusinessMessageSavedChange
  | CallSavedChange
  | ChatPositionRemovedChange
  | ChatPositionUpsertedChange
  | ChatPositionsReplacedChange
  | ChatFoldersReplacedChange
  | ChatListMembershipAddedChange
  | ChatListMembershipRemovedChange
  | ChatJoinRequestSavedChange
  | ChatMemberSavedChange
  | ChatBackgroundSavedChange
  | ChatPhotoInfoSavedChange
  | ChatThemeSavedChange
  | ChatSavedChange
  | ChatUpdatedChange
  | ChatActiveStoriesSavedChange
  | ChatBoostSavedChange
  | ChatRevenueAmountSavedChange
  | ContactCloseBirthdaysReplacedChange
  | DefaultBackgroundSelectionSavedChange
  | DirectMessagesChatTopicSavedChange
  | EmojiChatThemesSavedChange
  | KvEntryDeletedChange
  | KvEntrySavedChange
  | FileDownloadDeletedChange
  | FileDownloadSavedChange
  | FileDownloadUpdatedChange
  | FileGenerationRequestDeletedChange
  | FileGenerationRequestSavedChange
  | GiftAuctionStatesSavedChange
  | ForumTopicInfoSavedChange
  | ForumTopicSavedChange
  | GroupCallEncryptedParticipantUsersSavedChange
  | GroupCallMessageDeletedChange
  | GroupCallMessageErrorPatchedChange
  | GroupCallMessageSavedChange
  | GroupCallParticipantDeletedChange
  | GroupCallParticipantSavedChange
  | GroupCallSavedChange
  | GroupCallVerificationStateSavedChange
  | LanguagePackStringsReplacedChange
  | LiveStoryDonorsSavedChange
  | ManagedBotSavedChange
  | MessageContentOpenedChange
  | MessageSchedulingStateClearedChange
  | MessageSendAcknowledgedChange
  | MessageSendFailedChange
  | MessageSendSucceededChange
  | BusinessMessageUpdatedChange
  | MessageCreatedChange
  | MessageReactionUpdatedChange
  | MessageReactionSummariesReplacedChange
  | MessageUpdatedChange
  | MessagesDeletedChange
  | NotificationSettingsSavedChange
  | PollAnswerOptionsReplacedChange
  | PollReplacedChange
  | QuickReplyMessagesReplacedChange
  | QuickReplyShortcutDeletedChange
  | QuickReplyShortcutSavedChange
  | SecretChatSavedChange
  | SavedMessagesTagsReplacedChange
  | SavedMessagesTopicSavedChange
  | StoryDeletedChange
  | StorySavedChange
  | StarRevenueStatusSavedChange
  | StickerSavedChange
  | StickerSetSavedChange
  | SupergroupFullInfoSavedChange
  | SupergroupSavedChange
  | SuggestedActionsDeltaAppliedChange
  | TermsOfServiceReplacedChange
  | TextCompositionStylesReplacedChange
  | UserFullInfoSavedChange
  | UserPrivacySettingRulesSavedChange
  | UserSavedChange
  | UserUpdatedChange;

export type MessageUpdatedPayload = Pick<
  Message,
  | 'chat'
  | 'contentType'
  | 'editDate'
  | 'media'
  | 'reactions'
  | 'serviceAction'
  | 'telegramMessageId'
  | 'text'
  | 'textEntities'
>;

export type MessagesDeletedPayload = {
  chat: ChatModelRef;
  deletedAt: string;
  messages: MessageModelRef[];
};

export type ActiveNotificationSnapshotReplacedChange = {
  kind: 'activeNotificationSnapshot.replaced';
  snapshot: ActiveNotificationSnapshot;
};

export type ActiveNotificationUpsertedChange = {
  kind: 'activeNotification.upserted';
  messages: MessageState[];
  notification: ActiveNotification;
};

export type ActiveNotificationGroupUpdatedChange = {
  kind: 'activeNotificationGroup.updated';
  update: ActiveNotificationGroupUpdate;
};

export type ActiveLiveLocationMessagesReplacedChange = {
  kind: 'activeLiveLocationMessages.replaced';
  messages: {
    chatId: string;
    messageId: string;
  }[];
};

export type AttachmentMenuBotsReplacedChange = {
  kind: 'attachmentMenuBots.replaced';
  input: {
    bots: AttachmentMenuBot[];
    files: FileState[];
  };
};

export type BusinessMessageCreatedChange = {
  kind: 'businessMessage.created';
  businessMessage: BusinessMessageState;
  message: MessageState;
  payload: {
    message: Message;
  };
  replyToMessage: MessageState | null;
};

export type BusinessMessageUpdatedChange = {
  kind: 'businessMessage.updated';
  businessMessage: BusinessMessageState;
  message: MessageState;
  payload: {
    message: MessageUpdatedPayload;
  };
  replyToMessage: MessageState | null;
};

export type BusinessMessageSavedChange = {
  kind: 'businessMessage.saved';
  businessMessage: BusinessMessageState;
  message: MessageState;
  replyToMessage: MessageState | null;
};

export type BusinessMessagesDeletedChange = {
  kind: 'businessMessages.deleted';
  businessMessages: {
    chatId: string;
    connectionId: string;
    messageIds: string[];
  };
};

export type BusinessConnectionSavedChange = {
  kind: 'businessConnection.saved';
  connection: BusinessConnection;
};

export type CallSavedChange = {
  kind: 'call.saved';
  call: Call;
};

export type SecretChatSavedChange = {
  kind: 'secretChat.saved';
  chat: SecretChatState;
};

export type KvEntrySavedChange = {
  kind: 'kvEntry.saved';
  entry: KvEntry;
};

export type KvEntryDeletedChange = {
  kind: 'kvEntry.deleted';
  key: string;
};

export type FileDownloadSavedChange = {
  kind: 'fileDownload.saved';
  download: FileDownload;
};

export type FileDownloadUpdatedChange = {
  kind: 'fileDownload.updated';
  patch: FileDownloadPatch;
};

export type FileDownloadDeletedChange = {
  kind: 'fileDownload.deleted';
  fileId: number;
};

export type NotificationSettingsSavedChange = {
  kind: 'notificationSettings.saved';
  settings: NotificationSettings;
};

export type AutosaveSettingsSavedChange = {
  kind: 'autosaveSettings.saved';
  settings: AutosaveSettings;
};

export type AutosaveSettingsDeletedChange = {
  kind: 'autosaveSettings.deleted';
  scopeKey: string;
};

export type UserPrivacySettingRulesSavedChange = {
  kind: 'userPrivacySettingRules.saved';
  rules: UserPrivacySettingRules;
};

export type TermsOfServiceReplacedChange = {
  kind: 'termsOfService.replaced';
  terms: TermsOfService;
};

export type ContactCloseBirthdaysReplacedChange = {
  kind: 'contactCloseBirthdays.replaced';
  records: ContactCloseBirthday[];
};

export type TextCompositionStylesReplacedChange = {
  kind: 'textCompositionStyles.replaced';
  records: TextCompositionStyle[];
};

export type ChatRevenueAmountSavedChange = {
  kind: 'chatRevenueAmount.saved';
  record: ChatRevenueAmount;
};

export type FileGenerationRequestSavedChange = {
  kind: 'fileGenerationRequest.saved';
  record: FileGenerationRequest;
};

export type FileGenerationRequestDeletedChange = {
  kind: 'fileGenerationRequest.deleted';
  generationId: string;
};

export type ForumTopicSavedChange = {
  kind: 'forumTopic.saved';
  topic: ForumTopic;
};

export type ForumTopicInfoSavedChange = {
  kind: 'forumTopicInfo.saved';
  info: ForumTopicInfo;
};

export type GroupCallSavedChange = {
  kind: 'groupCall.saved';
  groupCall: GroupCall;
};

export type GroupCallMessageSavedChange = {
  kind: 'groupCallMessage.saved';
  message: GroupCallMessageState;
};

export type GroupCallMessageErrorPatchedChange = {
  kind: 'groupCallMessage.errorPatched';
  input: {
    error: NonNullable<GroupCallMessageState['error']>;
    groupCallId: number;
    messageId: number;
  };
};

export type GroupCallMessageDeletedChange = {
  kind: 'groupCallMessages.deleted';
  input: {
    groupCallId: number;
    messageIds: number[];
  };
};

export type GroupCallParticipantSavedChange = {
  kind: 'groupCallParticipant.saved';
  participant: GroupCallParticipant;
};

export type GroupCallParticipantDeletedChange = {
  kind: 'groupCallParticipant.deleted';
  input: {
    groupCallId: number;
    participantId: string;
  };
};

export type GroupCallEncryptedParticipantUsersSavedChange = {
  kind: 'groupCallEncryptedParticipantUsers.saved';
  record: GroupCallEncryptedParticipantUsers;
};

export type GroupCallVerificationStateSavedChange = {
  kind: 'groupCallVerificationState.saved';
  state: GroupCallVerificationState;
};

export type LanguagePackStringsReplacedChange = {
  kind: 'languagePackStrings.replaced';
  input: {
    languagePackId: string;
    localizationTarget: string;
    strings: LanguagePackString[];
  };
};

export type LiveStoryDonorsSavedChange = {
  kind: 'liveStoryDonors.saved';
  donors: LiveStoryDonors;
};

export type ManagedBotSavedChange = {
  kind: 'managedBot.saved';
  bot: ManagedBot;
};

export type DefaultBackgroundSelectionSavedChange = {
  kind: 'defaultBackgroundSelection.saved';
  input: {
    background: Background | null;
    files: FileState[];
    key: string;
    value: TelegramPayload | null;
  };
};

export type EmojiChatThemesSavedChange = {
  kind: 'emojiChatThemes.saved';
  input: {
    backgrounds: Background[];
    entry: KvEntry;
    files: FileState[];
  };
};

export type ChatBoostSavedChange = {
  kind: 'chatBoost.saved';
  record: ChatBoost;
};

export type ChatActiveStoriesSavedChange = {
  kind: 'chatActiveStories.saved';
  record: ChatActiveStories;
};

export type StorySavedChange = {
  kind: 'story.saved';
  story: StoryState;
};

export type StoryDeletedChange = {
  kind: 'story.deleted';
  story: StoryIdentity;
};

export type SavedMessagesTopicSavedChange = {
  kind: 'savedMessagesTopic.saved';
  topic: SavedMessagesTopic;
};

export type SavedMessagesTagsReplacedChange = {
  kind: 'savedMessagesTags.replaced';
  input: {
    records: SavedMessagesTag[];
    savedMessagesTopicId: string;
  };
};

export type DirectMessagesChatTopicSavedChange = {
  kind: 'directMessagesChatTopic.saved';
  topic: DirectMessagesChatTopic;
};

export type PollReplacedChange = {
  kind: 'poll.replaced';
  input: {
    options: PollOption[];
    poll: Poll;
  };
};

export type PollAnswerOptionsReplacedChange = {
  kind: 'pollAnswerOptions.replaced';
  input: {
    options: PollAnswerOption[];
    pollId: string;
    voterId: string;
  };
};

export type QuickReplyShortcutSavedChange = {
  kind: 'quickReplyShortcut.saved';
  input: {
    firstMessage: QuickReplyMessageState;
    shortcut: QuickReplyShortcut;
  };
};

export type QuickReplyShortcutDeletedChange = {
  kind: 'quickReplyShortcut.deleted';
  shortcutId: number;
};

export type QuickReplyMessagesReplacedChange = {
  kind: 'quickReplyMessages.replaced';
  input: {
    messages: QuickReplyMessageState[];
    shortcutId: number;
  };
};

export type ChatFoldersReplacedChange = {
  kind: 'chatFolders.replaced';
  folders: ChatFolderInfo[];
};

export type ChatListMembershipAddedChange = {
  kind: 'chatListMembership.added';
  membership: ChatListMembership;
};

export type ChatListMembershipRemovedChange = {
  kind: 'chatListMembership.removed';
  membership: Omit<ChatListMembership, 'chatList'>;
};

export type ChatMemberSavedChange = {
  kind: 'chatMember.saved';
  input: {
    inviteLink: ChatInviteLink | null;
    member: ChatMember;
  };
};

export type ChatJoinRequestSavedChange = {
  kind: 'chatJoinRequest.saved';
  input: {
    inviteLink: ChatInviteLink | null;
    request: ChatJoinRequest;
  };
};

export type SuggestedActionsDeltaAppliedChange = {
  kind: 'suggestedActionsDelta.applied';
  input: {
    addedActions: SuggestedAction[];
    removedActionKeys: string[];
  };
};

export type StarRevenueStatusSavedChange = {
  kind: 'starRevenueStatus.saved';
  status: StarRevenueStatus;
};

export type StickerSetSavedChange = {
  kind: 'stickerSet.saved';
  stickerSet: StickerSet;
};

export type StickerSavedChange = {
  kind: 'sticker.saved';
  input: {
    files: FileState[];
    sticker: Sticker;
  };
};

export type GiftAuctionStatesSavedChange = {
  kind: 'giftAuctionStates.saved';
  input: {
    auctions: GiftAuction[];
    files: FileState[];
    gifts: Gift[];
    states: GiftAuctionState[];
    stickers: Sticker[];
  };
};

export type ChatPhotoInfoSavedChange = {
  kind: 'chatPhotoInfo.saved';
  input: {
    chat: ChatPatch;
    files: FileState[];
  };
};

export type ChatBackgroundSavedChange = {
  kind: 'chatBackground.saved';
  input: {
    background: Background | null;
    chat: ChatPatch;
    files: FileState[];
  };
};

export type ChatThemeSavedChange = {
  kind: 'chatTheme.saved';
  input: {
    backgrounds: Background[];
    chat: ChatPatch;
    files: FileState[];
    upgradedGifts: UpgradedGift[];
  };
};

export type ChatSavedChange = {
  kind: 'chat.saved';
  chat: ChatState;
  positions: ChatPositionState[];
};

export type ChatUpdatedChange = {
  kind: 'chat.updated';
  chat: ChatPatch;
};

export type ChatPositionsReplacedChange = {
  kind: 'chat.positionsReplaced';
  chatId: string;
  positions: ChatPositionState[];
};

export type ChatPositionUpsertedChange = {
  kind: 'chat.positionUpserted';
  position: ChatPositionState;
};

export type ChatPositionRemovedChange = {
  kind: 'chat.positionRemoved';
  position: {
    chatId: string;
    listKey: string;
  };
};

export type UserSavedChange = {
  kind: 'user.saved';
  user: UserState;
};

export type UserUpdatedChange = {
  kind: 'user.updated';
  user: UserPatch;
};

export type UserFullInfoSavedChange = {
  kind: 'user.fullInfoSaved';
  info: {
    chatPhotos: ChatPhoto[];
    files: FileState[];
    user: UserPatch;
  };
};

export type BasicGroupSavedChange = {
  kind: 'basicGroup.saved';
  group: BasicGroup;
};

export type BasicGroupFullInfoSavedChange = {
  kind: 'basicGroup.fullInfoSaved';
  info: {
    chatPhotos: ChatPhoto[];
    files: FileState[];
    group: BasicGroupPatch;
  };
};

export type SupergroupSavedChange = {
  kind: 'supergroup.saved';
  group: Supergroup;
};

export type SupergroupFullInfoSavedChange = {
  kind: 'supergroup.fullInfoSaved';
  info: {
    chatPhotos: ChatPhoto[];
    files: FileState[];
    group: SupergroupPatch;
  };
};

export type MessageCreatedChange = {
  kind: 'message.created';
  liveMessage: {
    chatId: string;
    date: Date;
  } | null;
  message: MessageState;
  payload: {
    message: Message;
  };
};

export type MessageUpdatedChange = {
  kind: 'message.updated';
  message: MessagePatch;
  payload: {
    message: MessageUpdatedPayload;
  } | null;
};

export type MessageContentOpenedChange = {
  kind: 'message.contentOpened';
  message: {
    chatId: string;
    messageId: string;
  };
};

export type MessageSendAcknowledgedChange = {
  kind: 'messageSend.acknowledged';
  message: {
    chatId: string;
    messageId: string;
  };
};

export type MessageSchedulingStateClearedChange = {
  kind: 'messageSchedulingState.cleared';
  message: {
    chatId: string;
    messageId: string;
  };
};

export type MessageSendSucceededChange = {
  kind: 'messageSend.succeeded';
  currentMessage: MessageState;
  oldMessage: {
    chatId: string;
    messageId: string;
  };
};

export type MessageSendFailedChange = {
  kind: 'messageSend.failed';
  currentMessage: MessageState;
  oldMessage: {
    chatId: string;
    messageId: string;
  };
};

export type MessageReactionUpdatedChange = {
  kind: 'message.reactionUpdated';
  actorIsCurrentAccountSender: boolean;
  actorSender: MessageReactionSender;
  chatId: string;
  messageId: string;
  newReactionTypes: MessageReactionType[];
  oldReactionTypes: MessageReactionType[];
};

export type MessageReactionSummariesReplacedChange = {
  kind: 'message.reactionSummariesReplaced';
  message: {
    chatId: string;
    messageId: string;
    reactions: MessageReactionSummary[];
  };
};

export type MessagesDeletedChange = {
  kind: 'messages.deleted';
  messages: {
    chatId: string;
    messageIds: string[];
  };
  payload: {
    delete: MessagesDeletedPayload;
  };
};
