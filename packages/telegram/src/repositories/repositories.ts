import type { Database } from '../database/client.js';
import {
  createActiveNotificationRepository,
  type ActiveNotificationRepository
} from './activeNotificationRepository.js';
import {
  createAttachmentMenuBotRepository,
  type AttachmentMenuBotRepository
} from './attachmentMenuBotRepository.js';
import { createBackgroundRepository, type BackgroundRepository } from './backgroundRepository.js';
import {
  createBusinessMessageRepository,
  type BusinessMessageRepository
} from './businessMessageRepository.js';
import {
  createBusinessConnectionRepository,
  type BusinessConnectionRepository
} from './businessConnectionRepository.js';
import { createCallRepository, type CallRepository } from './callRepository.js';
import { createChatFolderRepository, type ChatFolderRepository } from './chatFolderRepository.js';
import { createChatMemberRepository, type ChatMemberRepository } from './chatMemberRepository.js';
import { createChatRepository, type ChatRepository } from './chatRepository.js';
import {
  createFileDownloadRepository,
  type FileDownloadRepository
} from './fileDownloadRepository.js';
import { createFileRepository, type FileRepository } from './fileRepository.js';
import { createGiftRepository, type GiftRepository } from './giftRepository.js';
import { createGroupRepository, type GroupRepository } from './groupRepository.js';
import { createKvRepository, type KvRepository } from './kvRepository.js';
import { createMessageRepository, type MessageRepository } from './messageRepository.js';
import { createPollRepository, type PollRepository } from './pollRepository.js';
import { createQuickReplyRepository, type QuickReplyRepository } from './quickReplyRepository.js';
import { createSecretChatRepository, type SecretChatRepository } from './secretChatRepository.js';
import {
  createRuntimeStateRepository,
  type RuntimeStateRepository
} from './runtimeStateRepository.js';
import { createSettingsRepository, type SettingsRepository } from './settingsRepository.js';
import {
  createStarRevenueRepository,
  type StarRevenueRepository
} from './starRevenueRepository.js';
import { createStateRepository, type StateRepository } from './stateRepository.js';
import { createStickerRepository, type StickerRepository } from './stickerRepository.js';
import { createStoryRepository, type StoryRepository } from './storyRepository.js';
import {
  createSuggestedActionRepository,
  type SuggestedActionRepository
} from './suggestedActionRepository.js';
import { createTopicRepository, type TopicRepository } from './topicRepository.js';
import { createUserRepository, type UserRepository } from './userRepository.js';

export type Repositories = {
  activeNotifications: ActiveNotificationRepository;
  attachmentMenuBots: AttachmentMenuBotRepository;
  backgrounds: BackgroundRepository;
  businessConnections: BusinessConnectionRepository;
  businessMessages: BusinessMessageRepository;
  calls: CallRepository;
  chatFolders: ChatFolderRepository;
  chatMembers: ChatMemberRepository;
  chats: ChatRepository;
  fileDownloads: FileDownloadRepository;
  files: FileRepository;
  gifts: GiftRepository;
  groups: GroupRepository;
  kv: KvRepository;
  messages: MessageRepository;
  polls: PollRepository;
  quickReplies: QuickReplyRepository;
  runtimeState: RuntimeStateRepository;
  secretChats: SecretChatRepository;
  settings: SettingsRepository;
  starRevenue: StarRevenueRepository;
  state: StateRepository;
  stickers: StickerRepository;
  stories: StoryRepository;
  suggestedActions: SuggestedActionRepository;
  topics: TopicRepository;
  users: UserRepository;
  transaction<T>(operation: (repositories: Repositories) => Promise<T>): Promise<T>;
};

export function createRepositories(database: Database): Repositories {
  return {
    activeNotifications: createActiveNotificationRepository(database),
    attachmentMenuBots: createAttachmentMenuBotRepository(database),
    backgrounds: createBackgroundRepository(database),
    businessConnections: createBusinessConnectionRepository(database),
    businessMessages: createBusinessMessageRepository(database),
    calls: createCallRepository(database),
    chatFolders: createChatFolderRepository(database),
    chatMembers: createChatMemberRepository(database),
    chats: createChatRepository(database),
    fileDownloads: createFileDownloadRepository(database),
    files: createFileRepository(database),
    gifts: createGiftRepository(database),
    groups: createGroupRepository(database),
    kv: createKvRepository(database),
    messages: createMessageRepository(database),
    polls: createPollRepository(database),
    quickReplies: createQuickReplyRepository(database),
    runtimeState: createRuntimeStateRepository(database),
    secretChats: createSecretChatRepository(database),
    settings: createSettingsRepository(database),
    starRevenue: createStarRevenueRepository(database),
    state: createStateRepository(database),
    stickers: createStickerRepository(database),
    stories: createStoryRepository(database),
    suggestedActions: createSuggestedActionRepository(database),
    topics: createTopicRepository(database),
    users: createUserRepository(database),
    transaction(operation) {
      return database.transaction((transaction) => operation(createRepositories(transaction)));
    }
  };
}
