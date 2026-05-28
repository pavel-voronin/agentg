import {
  boolean,
  customType,
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

import type { JsonValue } from '@agentg/events/json';

const bigintText = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'bigint';
  }
});

const byteaText = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'bytea';
  }
});

export const telegramFiles = pgTable('telegram_files', {
  expectedSize: bigintText('expected_size').notNull(),
  id: integer('id').primaryKey(),
  local: jsonb('local').$type<JsonValue>().notNull(),
  remote: jsonb('remote').$type<JsonValue>().notNull(),
  size: bigintText('size')
});

export const telegramAttachmentMenuBots = pgTable(
  'telegram_attachment_menu_bots',
  {
    androidIconFileId: integer('android_icon_file_id'),
    androidSideMenuIconFileId: integer('android_side_menu_icon_file_id'),
    botUserId: bigintText('bot_user_id').notNull(),
    defaultIconFileId: integer('default_icon_file_id'),
    iconColor: jsonb('icon_color').$type<JsonValue>(),
    iosAnimatedIconFileId: integer('ios_animated_icon_file_id'),
    iosSideMenuIconFileId: integer('ios_side_menu_icon_file_id'),
    iosStaticIconFileId: integer('ios_static_icon_file_id'),
    isAdded: boolean('is_added').notNull(),
    macosIconFileId: integer('macos_icon_file_id'),
    macosSideMenuIconFileId: integer('macos_side_menu_icon_file_id'),
    name: text('name').notNull(),
    nameColor: jsonb('name_color').$type<JsonValue>(),
    requestWriteAccess: boolean('request_write_access').notNull(),
    showDisclaimerInSideMenu: boolean('show_disclaimer_in_side_menu').notNull(),
    showInAttachmentMenu: boolean('show_in_attachment_menu').notNull(),
    showInSideMenu: boolean('show_in_side_menu').notNull(),
    supportsBotChats: boolean('supports_bot_chats').notNull(),
    supportsChannelChats: boolean('supports_channel_chats').notNull(),
    supportsGroupChats: boolean('supports_group_chats').notNull(),
    supportsSelfChat: boolean('supports_self_chat').notNull(),
    supportsUserChats: boolean('supports_user_chats').notNull(),
    webAppPlaceholderFileId: integer('web_app_placeholder_file_id')
  },
  (table) => [
    primaryKey({
      columns: [table.botUserId],
      name: 'telegram_attachment_menu_bots_pk'
    }),
    foreignKey({
      columns: [table.androidIconFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_attachment_menu_bots_android_icon_file_id_fk'
    }),
    foreignKey({
      columns: [table.androidSideMenuIconFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_attachment_menu_bots_android_side_menu_icon_file_id_fk'
    }),
    foreignKey({
      columns: [table.defaultIconFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_attachment_menu_bots_default_icon_file_id_fk'
    }),
    foreignKey({
      columns: [table.iosAnimatedIconFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_attachment_menu_bots_ios_animated_icon_file_id_fk'
    }),
    foreignKey({
      columns: [table.iosSideMenuIconFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_attachment_menu_bots_ios_side_menu_icon_file_id_fk'
    }),
    foreignKey({
      columns: [table.iosStaticIconFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_attachment_menu_bots_ios_static_icon_file_id_fk'
    }),
    foreignKey({
      columns: [table.macosIconFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_attachment_menu_bots_macos_icon_file_id_fk'
    }),
    foreignKey({
      columns: [table.macosSideMenuIconFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_attachment_menu_bots_macos_side_menu_icon_file_id_fk'
    }),
    foreignKey({
      columns: [table.webAppPlaceholderFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_attachment_menu_bots_web_app_placeholder_file_id_fk'
    })
  ]
);

export const telegramAutosaveSettings = pgTable('telegram_autosave_settings', {
  autosavePhotos: boolean('autosave_photos').notNull(),
  autosaveVideos: boolean('autosave_videos').notNull(),
  maxVideoFileSize: bigintText('max_video_file_size').notNull(),
  scopeKey: text('scope_key').primaryKey()
});

export const telegramBackgrounds = pgTable('telegram_backgrounds', {
  document: jsonb('document').$type<JsonValue>(),
  id: bigintText('id').primaryKey(),
  isDark: boolean('is_dark').notNull(),
  isDefault: boolean('is_default').notNull(),
  name: text('name').notNull(),
  type: jsonb('type').$type<JsonValue>().notNull()
});

export const telegramChatPhotos = pgTable('telegram_chat_photos', {
  addedDate: timestamp('added_date', { withTimezone: true }).notNull(),
  animation: jsonb('animation').$type<JsonValue>(),
  id: bigintText('id').primaryKey(),
  minithumbnail: jsonb('minithumbnail').$type<JsonValue>(),
  sizes: jsonb('sizes').$type<JsonValue>().notNull(),
  smallAnimation: jsonb('small_animation').$type<JsonValue>(),
  sticker: jsonb('sticker').$type<JsonValue>()
});

export const telegramBasicGroups = pgTable(
  'telegram_basic_groups',
  {
    botCommands: jsonb('bot_commands').$type<JsonValue>(),
    canHideMembers: boolean('can_hide_members'),
    canToggleAggressiveAntiSpam: boolean('can_toggle_aggressive_anti_spam'),
    creatorUserId: bigintText('creator_user_id'),
    description: text('description'),
    id: bigintText('id').notNull(),
    inviteLink: jsonb('invite_link').$type<JsonValue>(),
    isActive: boolean('is_active'),
    memberCount: integer('member_count'),
    members: jsonb('members').$type<JsonValue>(),
    photoId: bigintText('photo_id'),
    status: jsonb('status').$type<JsonValue>(),
    upgradedToSupergroupId: bigintText('upgraded_to_supergroup_id')
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: 'telegram_basic_groups_pk'
    }),
    foreignKey({
      columns: [table.photoId],
      foreignColumns: [telegramChatPhotos.id],
      name: 'telegram_basic_groups_photo_id_fk'
    })
  ]
);

export const telegramBusinessConnections = pgTable('telegram_business_connections', {
  date: timestamp('date', { withTimezone: true }).notNull(),
  id: text('id').primaryKey(),
  isEnabled: boolean('is_enabled').notNull(),
  rights: jsonb('rights').$type<JsonValue>(),
  userChatId: bigintText('user_chat_id').notNull(),
  userId: bigintText('user_id').notNull()
});

export const telegramMessages = pgTable(
  'telegram_messages',
  {
    authorSignature: text('author_signature'),
    autoDeleteIn: doublePrecision('auto_delete_in'),
    canBeSaved: boolean('can_be_saved'),
    chatId: bigintText('chat_id').notNull(),
    containsUnreadMention: boolean('contains_unread_mention'),
    containsUnreadPollVotes: boolean('contains_unread_poll_votes'),
    content: jsonb('content').$type<JsonValue>(),
    date: timestamp('date', { withTimezone: true }),
    editDate: timestamp('edit_date', { withTimezone: true }),
    effectId: bigintText('effect_id'),
    factCheck: jsonb('fact_check').$type<JsonValue>(),
    forwardInfo: jsonb('forward_info').$type<JsonValue>(),
    guestBotCallerId: jsonb('guest_bot_caller_id').$type<JsonValue>(),
    hasTimestampedMedia: boolean('has_timestamped_media'),
    id: bigintText('id').notNull(),
    importInfo: jsonb('import_info').$type<JsonValue>(),
    interactionInfo: jsonb('interaction_info').$type<JsonValue>(),
    isChannelPost: boolean('is_channel_post'),
    isFromOffline: boolean('is_from_offline'),
    isOutgoing: boolean('is_outgoing'),
    isPaidStarSuggestedPost: boolean('is_paid_star_suggested_post'),
    isPaidTonSuggestedPost: boolean('is_paid_ton_suggested_post'),
    isPinned: boolean('is_pinned'),
    mediaAlbumId: bigintText('media_album_id'),
    paidMessageStarCount: bigintText('paid_message_star_count'),
    replyMarkup: jsonb('reply_markup').$type<JsonValue>(),
    replyTo: jsonb('reply_to').$type<JsonValue>(),
    restrictionInfo: jsonb('restriction_info').$type<JsonValue>(),
    schedulingState: jsonb('scheduling_state').$type<JsonValue>(),
    selfDestructIn: doublePrecision('self_destruct_in'),
    selfDestructType: jsonb('self_destruct_type').$type<JsonValue>(),
    sendAcknowledged: boolean('send_acknowledged'),
    senderBoostCount: integer('sender_boost_count'),
    senderBusinessBotUserId: bigintText('sender_business_bot_user_id'),
    senderId: jsonb('sender_id').$type<JsonValue>(),
    senderTag: text('sender_tag'),
    sendingState: jsonb('sending_state').$type<JsonValue>(),
    suggestedPostInfo: jsonb('suggested_post_info').$type<JsonValue>(),
    summaryLanguageCode: text('summary_language_code'),
    topicId: jsonb('topic_id').$type<JsonValue>(),
    unreadReactions: jsonb('unread_reactions').$type<JsonValue>(),
    viaBotUserId: bigintText('via_bot_user_id')
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.id],
      name: 'telegram_messages_pk'
    })
  ]
);

export const telegramBusinessMessages = pgTable(
  'telegram_business_messages',
  {
    connectionId: text('connection_id').notNull(),
    messageChatId: bigintText('message_chat_id').notNull(),
    messageId: bigintText('message_id').notNull(),
    replyToMessageChatId: bigintText('reply_to_message_chat_id'),
    replyToMessageId: bigintText('reply_to_message_id')
  },
  (table) => [
    primaryKey({
      columns: [table.connectionId, table.messageChatId, table.messageId],
      name: 'telegram_business_messages_pk'
    }),
    foreignKey({
      columns: [table.messageChatId, table.messageId],
      foreignColumns: [telegramMessages.chatId, telegramMessages.id],
      name: 'telegram_business_messages_message_fk'
    }),
    foreignKey({
      columns: [table.replyToMessageChatId, table.replyToMessageId],
      foreignColumns: [telegramMessages.chatId, telegramMessages.id],
      name: 'telegram_business_messages_reply_to_message_fk'
    })
  ]
);

export const telegramCalls = pgTable('telegram_calls', {
  id: integer('id').primaryKey(),
  isOutgoing: boolean('is_outgoing').notNull(),
  isVideo: boolean('is_video').notNull(),
  state: jsonb('state').$type<JsonValue>().notNull(),
  uniqueId: bigintText('unique_id').notNull(),
  userId: bigintText('user_id').notNull()
});

export const telegramChatActiveStories = pgTable('telegram_chat_active_stories', {
  canBeArchived: boolean('can_be_archived').notNull(),
  chatId: bigintText('chat_id').primaryKey(),
  list: jsonb('list').$type<JsonValue>(),
  maxReadStoryId: integer('max_read_story_id').notNull(),
  order: bigintText('order').notNull(),
  stories: jsonb('stories').$type<JsonValue>().notNull()
});

export const telegramChatBoosts = pgTable(
  'telegram_chat_boosts',
  {
    chatId: bigintText('chat_id').notNull(),
    count: integer('count').notNull(),
    expirationDate: timestamp('expiration_date', { withTimezone: true }).notNull(),
    id: text('id').notNull(),
    source: jsonb('source').$type<JsonValue>().notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.id],
      name: 'telegram_chat_boosts_pk'
    })
  ]
);

export const telegramChatFolderInfos = pgTable('telegram_chat_folder_infos', {
  colorId: integer('color_id').notNull(),
  hasMyInviteLinks: boolean('has_my_invite_links').notNull(),
  icon: jsonb('icon').$type<JsonValue>().notNull(),
  id: integer('id').primaryKey(),
  isShareable: boolean('is_shareable').notNull(),
  name: jsonb('name').$type<JsonValue>().notNull(),
  position: integer('position').notNull()
});

export const telegramChatInviteLinks = pgTable(
  'telegram_chat_invite_links',
  {
    chatId: bigintText('chat_id').notNull(),
    createsJoinRequest: boolean('creates_join_request').notNull(),
    creatorUserId: bigintText('creator_user_id').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    editDate: timestamp('edit_date', { withTimezone: true }).notNull(),
    expirationDate: timestamp('expiration_date', { withTimezone: true }).notNull(),
    expiredMemberCount: integer('expired_member_count').notNull(),
    inviteLink: text('invite_link').notNull(),
    isPrimary: boolean('is_primary').notNull(),
    isRevoked: boolean('is_revoked').notNull(),
    memberCount: integer('member_count').notNull(),
    memberLimit: integer('member_limit').notNull(),
    name: text('name').notNull(),
    pendingJoinRequestCount: integer('pending_join_request_count').notNull(),
    subscriptionPricing: jsonb('subscription_pricing').$type<JsonValue>()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.inviteLink],
      name: 'telegram_chat_invite_links_pk'
    })
  ]
);

export const telegramChatJoinRequests = pgTable(
  'telegram_chat_join_requests',
  {
    bio: text('bio').notNull(),
    chatId: bigintText('chat_id').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    inviteLink: text('invite_link'),
    userChatId: bigintText('user_chat_id'),
    userId: bigintText('user_id').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.userId],
      name: 'telegram_chat_join_requests_pk'
    }),
    foreignKey({
      columns: [table.chatId, table.inviteLink],
      foreignColumns: [telegramChatInviteLinks.chatId, telegramChatInviteLinks.inviteLink],
      name: 'telegram_chat_join_requests_invite_link_fk'
    })
  ]
);

export const telegramChatMembers = pgTable(
  'telegram_chat_members',
  {
    chatId: bigintText('chat_id').notNull(),
    inviterUserId: bigintText('inviter_user_id'),
    joinedChatDate: timestamp('joined_chat_date', { withTimezone: true }).notNull(),
    memberId: text('member_id').notNull(),
    status: jsonb('status').$type<JsonValue>().notNull(),
    tag: text('tag').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.memberId],
      name: 'telegram_chat_members_pk'
    })
  ]
);

export const telegramChatPositions = pgTable(
  'telegram_chat_positions',
  {
    chatId: bigintText('chat_id').notNull(),
    isPinned: boolean('is_pinned').notNull(),
    listKey: text('list_key').notNull(),
    order: bigintText('order').notNull(),
    source: jsonb('source').$type<JsonValue>()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.listKey],
      name: 'telegram_chat_positions_pk'
    })
  ]
);

export const telegramChatRevenueAmounts = pgTable('telegram_chat_revenue_amounts', {
  availableAmount: bigintText('available_amount').notNull(),
  balanceAmount: bigintText('balance_amount').notNull(),
  chatId: bigintText('chat_id').primaryKey(),
  cryptocurrency: text('cryptocurrency').notNull(),
  totalAmount: bigintText('total_amount').notNull(),
  withdrawalEnabled: boolean('withdrawal_enabled').notNull()
});

export const telegramChats = pgTable(
  'telegram_chats',
  {
    accentColorId: integer('accent_color_id'),
    actionBar: jsonb('action_bar').$type<JsonValue>(),
    availableReactions: jsonb('available_reactions').$type<JsonValue>(),
    background: jsonb('background').$type<JsonValue>(),
    backgroundCustomEmojiId: bigintText('background_custom_emoji_id'),
    blockList: jsonb('block_list').$type<JsonValue>(),
    businessBotManageBar: jsonb('business_bot_manage_bar').$type<JsonValue>(),
    canBeDeletedForAllUsers: boolean('can_be_deleted_for_all_users'),
    canBeDeletedOnlyForSelf: boolean('can_be_deleted_only_for_self'),
    canBeReported: boolean('can_be_reported'),
    chatLists: jsonb('chat_lists').$type<JsonValue>(),
    clientData: text('client_data'),
    defaultDisableNotification: boolean('default_disable_notification'),
    draftMessage: jsonb('draft_message').$type<JsonValue>(),
    emojiStatus: jsonb('emoji_status').$type<JsonValue>(),
    hasProtectedContent: boolean('has_protected_content'),
    hasScheduledMessages: boolean('has_scheduled_messages'),
    id: bigintText('id').notNull(),
    isMarkedAsUnread: boolean('is_marked_as_unread'),
    isTranslatable: boolean('is_translatable'),
    lastMessageChatId: bigintText('last_message_chat_id'),
    lastMessageId: bigintText('last_message_id'),
    lastReadInboxMessageId: bigintText('last_read_inbox_message_id'),
    lastReadOutboxMessageId: bigintText('last_read_outbox_message_id'),
    messageAutoDeleteTime: integer('message_auto_delete_time'),
    messageSenderId: jsonb('message_sender_id').$type<JsonValue>(),
    notificationSettings: jsonb('notification_settings').$type<JsonValue>(),
    pendingJoinRequests: jsonb('pending_join_requests').$type<JsonValue>(),
    permissions: jsonb('permissions').$type<JsonValue>(),
    photo: jsonb('photo').$type<JsonValue>(),
    profileAccentColorId: integer('profile_accent_color_id'),
    profileBackgroundCustomEmojiId: bigintText('profile_background_custom_emoji_id'),
    replyMarkupMessageId: bigintText('reply_markup_message_id'),
    theme: jsonb('theme').$type<JsonValue>(),
    title: text('title'),
    type: jsonb('type').$type<JsonValue>(),
    unreadCount: integer('unread_count'),
    unreadMentionCount: integer('unread_mention_count'),
    unreadPollVoteCount: integer('unread_poll_vote_count'),
    unreadReactionCount: integer('unread_reaction_count'),
    upgradedGiftColors: jsonb('upgraded_gift_colors').$type<JsonValue>(),
    videoChat: jsonb('video_chat').$type<JsonValue>(),
    viewAsTopics: boolean('view_as_topics')
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: 'telegram_chats_pk'
    }),
    foreignKey({
      columns: [table.lastMessageChatId, table.lastMessageId],
      foreignColumns: [telegramMessages.chatId, telegramMessages.id],
      name: 'telegram_chats_last_message_fk'
    })
  ]
);

export const telegramChecklistTasks = pgTable(
  'telegram_checklist_tasks',
  {
    chatId: bigintText('chat_id').notNull(),
    completedBy: jsonb('completed_by').$type<JsonValue>().notNull(),
    completionDate: timestamp('completion_date', { withTimezone: true }).notNull(),
    id: integer('id').notNull(),
    messageId: bigintText('message_id').notNull(),
    text: jsonb('text').$type<JsonValue>().notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.messageId, table.id],
      name: 'telegram_checklist_tasks_pk'
    })
  ]
);

export const telegramCloseBirthdayUsers = pgTable('telegram_close_birthday_users', {
  birthdate: jsonb('birthdate').$type<JsonValue>().notNull(),
  userId: bigintText('user_id').primaryKey()
});

export const telegramDirectMessagesChatTopics = pgTable(
  'telegram_direct_messages_chat_topics',
  {
    canSendUnpaidMessages: boolean('can_send_unpaid_messages').notNull(),
    chatId: bigintText('chat_id').notNull(),
    draftMessage: jsonb('draft_message').$type<JsonValue>().notNull(),
    id: bigintText('id').notNull(),
    isMarkedAsUnread: boolean('is_marked_as_unread').notNull(),
    lastMessageChatId: bigintText('last_message_chat_id'),
    lastMessageId: bigintText('last_message_id'),
    lastReadInboxMessageId: bigintText('last_read_inbox_message_id').notNull(),
    lastReadOutboxMessageId: bigintText('last_read_outbox_message_id').notNull(),
    order: bigintText('order').notNull(),
    senderId: jsonb('sender_id').$type<JsonValue>().notNull(),
    unreadCount: bigintText('unread_count').notNull(),
    unreadReactionCount: bigintText('unread_reaction_count').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.id],
      name: 'telegram_direct_messages_chat_topics_pk'
    }),
    foreignKey({
      columns: [table.lastMessageChatId, table.lastMessageId],
      foreignColumns: [telegramMessages.chatId, telegramMessages.id],
      name: 'telegram_direct_messages_chat_topics_last_message_fk'
    })
  ]
);

export const telegramFileGenerationRequests = pgTable('telegram_file_generation_requests', {
  conversion: text('conversion').notNull(),
  destinationPath: text('destination_path').notNull(),
  generationId: bigintText('generation_id').primaryKey(),
  originalPath: text('original_path').notNull()
});

export const telegramFileDownloads = pgTable(
  'telegram_file_downloads',
  {
    addDate: timestamp('add_date', { withTimezone: true }).notNull(),
    completeDate: timestamp('complete_date', { withTimezone: true }).notNull(),
    fileId: integer('file_id').notNull(),
    isPaused: boolean('is_paused').notNull(),
    messageChatId: bigintText('message_chat_id').notNull(),
    messageId: bigintText('message_id').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.fileId],
      name: 'telegram_file_downloads_pk'
    }),
    foreignKey({
      columns: [table.messageChatId, table.messageId],
      foreignColumns: [telegramMessages.chatId, telegramMessages.id],
      name: 'telegram_file_downloads_message_fk'
    })
  ]
);

export const telegramForumTopicInfos = pgTable(
  'telegram_forum_topic_infos',
  {
    chatId: bigintText('chat_id').notNull(),
    creationDate: timestamp('creation_date', { withTimezone: true }).notNull(),
    creatorId: jsonb('creator_id').$type<JsonValue>().notNull(),
    forumTopicId: integer('forum_topic_id').notNull(),
    icon: jsonb('icon').$type<JsonValue>().notNull(),
    isClosed: boolean('is_closed').notNull(),
    isGeneral: boolean('is_general').notNull(),
    isHidden: boolean('is_hidden').notNull(),
    isNameImplicit: boolean('is_name_implicit').notNull(),
    isOutgoing: boolean('is_outgoing').notNull(),
    name: text('name').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.forumTopicId],
      name: 'telegram_forum_topic_infos_pk'
    })
  ]
);

export const telegramForumTopics = pgTable(
  'telegram_forum_topics',
  {
    chatId: bigintText('chat_id').notNull(),
    draftMessage: jsonb('draft_message').$type<JsonValue>(),
    forumTopicId: integer('forum_topic_id').notNull(),
    isPinned: boolean('is_pinned'),
    lastMessageChatId: bigintText('last_message_chat_id'),
    lastMessageId: bigintText('last_message_id'),
    lastReadInboxMessageId: bigintText('last_read_inbox_message_id'),
    lastReadOutboxMessageId: bigintText('last_read_outbox_message_id'),
    notificationSettings: jsonb('notification_settings').$type<JsonValue>(),
    order: bigintText('order'),
    unreadCount: integer('unread_count'),
    unreadMentionCount: integer('unread_mention_count'),
    unreadPollVoteCount: integer('unread_poll_vote_count'),
    unreadReactionCount: integer('unread_reaction_count')
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.forumTopicId],
      name: 'telegram_forum_topics_pk'
    }),
    foreignKey({
      columns: [table.lastMessageChatId, table.lastMessageId],
      foreignColumns: [telegramMessages.chatId, telegramMessages.id],
      name: 'telegram_forum_topics_last_message_fk'
    })
  ]
);

export const telegramGiftAuctions = pgTable('telegram_gift_auctions', {
  giftsPerRound: integer('gifts_per_round').notNull(),
  id: text('id').primaryKey(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull()
});

export const telegramStickers = pgTable(
  'telegram_stickers',
  {
    emoji: text('emoji'),
    fileId: integer('file_id').notNull(),
    format: jsonb('format').$type<JsonValue>().notNull(),
    fullType: jsonb('full_type').$type<JsonValue>().notNull(),
    height: integer('height').notNull(),
    id: bigintText('id'),
    setId: bigintText('set_id'),
    thumbnail: jsonb('thumbnail').$type<JsonValue>().notNull(),
    width: integer('width').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.fileId],
      name: 'telegram_stickers_pk'
    }),
    foreignKey({
      columns: [table.fileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_stickers_file_fk'
    })
  ]
);

export const telegramGifts = pgTable(
  'telegram_gifts',
  {
    auctionId: text('auction_id'),
    background: jsonb('background').$type<JsonValue>().notNull(),
    defaultSellStarCount: bigintText('default_sell_star_count').notNull(),
    firstSendDate: timestamp('first_send_date', { withTimezone: true }).notNull(),
    hasColors: boolean('has_colors').notNull(),
    id: bigintText('id').notNull(),
    isForBirthday: boolean('is_for_birthday').notNull(),
    isPremium: boolean('is_premium').notNull(),
    lastSendDate: timestamp('last_send_date', { withTimezone: true }).notNull(),
    nextSendDate: timestamp('next_send_date', { withTimezone: true }).notNull(),
    overallLimits: jsonb('overall_limits').$type<JsonValue>().notNull(),
    publisherChatId: bigintText('publisher_chat_id'),
    starCount: bigintText('star_count').notNull(),
    stickerFileId: integer('sticker_file_id').notNull(),
    upgradeStarCount: bigintText('upgrade_star_count').notNull(),
    upgradeVariantCount: integer('upgrade_variant_count'),
    userLimits: jsonb('user_limits').$type<JsonValue>().notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: 'telegram_gifts_pk'
    }),
    foreignKey({
      columns: [table.stickerFileId],
      foreignColumns: [telegramStickers.fileId],
      name: 'telegram_gifts_sticker_fk'
    }),
    foreignKey({
      columns: [table.auctionId],
      foreignColumns: [telegramGiftAuctions.id],
      name: 'telegram_gifts_auction_fk'
    })
  ]
);

export const telegramGiftAuctionStates = pgTable(
  'telegram_gift_auction_states',
  {
    auctionId: text('auction_id').notNull(),
    giftId: bigintText('gift_id').notNull(),
    state: jsonb('state').$type<JsonValue>().notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.auctionId],
      name: 'telegram_gift_auction_states_pk'
    }),
    foreignKey({
      columns: [table.auctionId],
      foreignColumns: [telegramGiftAuctions.id],
      name: 'telegram_gift_auction_states_auction_fk'
    }),
    foreignKey({
      columns: [table.giftId],
      foreignColumns: [telegramGifts.id],
      name: 'telegram_gift_auction_states_gift_fk'
    })
  ]
);

export const telegramGroupCallEncryptedParticipantUsers = pgTable(
  'telegram_group_call_encrypted_participant_users',
  {
    groupCallId: integer('group_call_id').primaryKey(),
    participantUserIds: jsonb('participant_user_ids').$type<JsonValue>().notNull()
  }
);

export const telegramGroupCallMessages = pgTable(
  'telegram_group_call_messages',
  {
    canBeDeleted: boolean('can_be_deleted'),
    date: timestamp('date', { withTimezone: true }),
    error: jsonb('error').$type<JsonValue>(),
    groupCallId: integer('group_call_id').notNull(),
    isFromOwner: boolean('is_from_owner'),
    messageId: integer('message_id').notNull(),
    paidMessageStarCount: bigintText('paid_message_star_count'),
    senderId: jsonb('sender_id').$type<JsonValue>(),
    text: jsonb('text').$type<JsonValue>()
  },
  (table) => [
    primaryKey({
      columns: [table.groupCallId, table.messageId],
      name: 'telegram_group_call_messages_pk'
    })
  ]
);

export const telegramGroupCallParticipants = pgTable(
  'telegram_group_call_participants',
  {
    audioSourceId: integer('audio_source_id').notNull(),
    bio: text('bio').notNull(),
    canBeMutedForAllUsers: boolean('can_be_muted_for_all_users').notNull(),
    canBeMutedForCurrentUser: boolean('can_be_muted_for_current_user').notNull(),
    canBeUnmutedForAllUsers: boolean('can_be_unmuted_for_all_users').notNull(),
    canBeUnmutedForCurrentUser: boolean('can_be_unmuted_for_current_user').notNull(),
    canUnmuteSelf: boolean('can_unmute_self').notNull(),
    groupCallId: integer('group_call_id').notNull(),
    isCurrentUser: boolean('is_current_user').notNull(),
    isHandRaised: boolean('is_hand_raised').notNull(),
    isMutedForAllUsers: boolean('is_muted_for_all_users').notNull(),
    isMutedForCurrentUser: boolean('is_muted_for_current_user').notNull(),
    isSpeaking: boolean('is_speaking').notNull(),
    order: text('order').notNull(),
    participantId: text('participant_id').notNull(),
    screenSharingAudioSourceId: integer('screen_sharing_audio_source_id').notNull(),
    screenSharingVideoInfo: jsonb('screen_sharing_video_info').$type<JsonValue>(),
    videoInfo: jsonb('video_info').$type<JsonValue>(),
    volumeLevel: integer('volume_level').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.groupCallId, table.participantId],
      name: 'telegram_group_call_participants_pk'
    })
  ]
);

export const telegramGroupCallVerificationStates = pgTable(
  'telegram_group_call_verification_states',
  {
    emojis: jsonb('emojis').$type<JsonValue>().notNull(),
    generation: integer('generation').notNull(),
    groupCallId: integer('group_call_id').primaryKey()
  }
);

export const telegramGroupCalls = pgTable('telegram_group_calls', {
  areMessagesAllowed: boolean('are_messages_allowed').notNull(),
  canBeManaged: boolean('can_be_managed').notNull(),
  canDeleteMessages: boolean('can_delete_messages').notNull(),
  canEnableVideo: boolean('can_enable_video').notNull(),
  canSendMessages: boolean('can_send_messages').notNull(),
  canToggleAreMessagesAllowed: boolean('can_toggle_are_messages_allowed').notNull(),
  canToggleMuteNewParticipants: boolean('can_toggle_mute_new_participants').notNull(),
  duration: integer('duration').notNull(),
  enabledStartNotification: boolean('enabled_start_notification').notNull(),
  hasHiddenListeners: boolean('has_hidden_listeners').notNull(),
  id: integer('id').primaryKey(),
  inviteLink: text('invite_link').notNull(),
  isActive: boolean('is_active').notNull(),
  isJoined: boolean('is_joined').notNull(),
  isLiveStory: boolean('is_live_story').notNull(),
  isMyVideoEnabled: boolean('is_my_video_enabled').notNull(),
  isMyVideoPaused: boolean('is_my_video_paused').notNull(),
  isOwned: boolean('is_owned').notNull(),
  isRtmpStream: boolean('is_rtmp_stream').notNull(),
  isVideoChat: boolean('is_video_chat').notNull(),
  isVideoRecorded: boolean('is_video_recorded').notNull(),
  loadedAllParticipants: boolean('loaded_all_participants').notNull(),
  messageSenderId: jsonb('message_sender_id').$type<JsonValue>(),
  muteNewParticipants: boolean('mute_new_participants').notNull(),
  needRejoin: boolean('need_rejoin').notNull(),
  paidMessageStarCount: bigintText('paid_message_star_count').notNull(),
  participantCount: integer('participant_count').notNull(),
  recentSpeakers: jsonb('recent_speakers').$type<JsonValue>().notNull(),
  recordDuration: integer('record_duration'),
  scheduledStartDate: timestamp('scheduled_start_date', { withTimezone: true }).notNull(),
  title: text('title').notNull(),
  uniqueId: bigintText('unique_id').notNull()
});

export const telegramActiveLiveLocationMessages = pgTable(
  'telegram_active_live_location_messages',
  {
    chatId: bigintText('chat_id').notNull(),
    messageId: bigintText('message_id').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.messageId],
      name: 'telegram_active_live_location_messages_pk'
    }),
    foreignKey({
      columns: [table.chatId, table.messageId],
      foreignColumns: [telegramMessages.chatId, telegramMessages.id],
      name: 'telegram_active_live_location_messages_message_fk'
    })
  ]
);

export const telegramKv = pgTable('telegram_kv', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<JsonValue>().notNull()
});

export const telegramLanguagePackStrings = pgTable(
  'telegram_language_pack_strings',
  {
    key: text('key').notNull(),
    languagePackId: text('language_pack_id').notNull(),
    localizationTarget: text('localization_target').notNull(),
    value: jsonb('value').$type<JsonValue>()
  },
  (table) => [
    primaryKey({
      columns: [table.localizationTarget, table.languagePackId, table.key],
      name: 'telegram_language_pack_strings_pk'
    })
  ]
);

export const telegramLiveStoryDonors = pgTable('telegram_live_story_donors', {
  groupCallId: integer('group_call_id').primaryKey(),
  topDonors: jsonb('top_donors').$type<JsonValue>().notNull(),
  totalStarCount: bigintText('total_star_count').notNull()
});

export const telegramManagedBots = pgTable('telegram_managed_bots', {
  botUserId: bigintText('bot_user_id').primaryKey(),
  creatorUserId: bigintText('creator_user_id').notNull()
});

export const telegramMessageReactions = pgTable(
  'telegram_message_reactions',
  {
    chatId: bigintText('chat_id').notNull(),
    isChosen: boolean('is_chosen').notNull(),
    messageId: bigintText('message_id').notNull(),
    reactionType: text('reaction_type').notNull(),
    recentSenderIds: jsonb('recent_sender_ids').$type<JsonValue>().notNull(),
    totalCount: integer('total_count').notNull(),
    usedSenderId: jsonb('used_sender_id').$type<JsonValue>()
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.messageId, table.reactionType],
      name: 'telegram_message_reactions_pk'
    })
  ]
);

export const telegramActiveNotificationGroups = pgTable(
  'telegram_active_notification_groups',
  {
    chatId: bigintText('chat_id').notNull(),
    id: integer('id').notNull(),
    notificationSettingsChatId: bigintText('notification_settings_chat_id'),
    notificationSoundId: bigintText('notification_sound_id'),
    totalCount: integer('total_count').notNull(),
    type: text('type').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: 'telegram_active_notification_groups_pk'
    }),
    foreignKey({
      columns: [table.chatId],
      foreignColumns: [telegramChats.id],
      name: 'telegram_active_notification_groups_chat_fk'
    }),
    foreignKey({
      columns: [table.notificationSettingsChatId],
      foreignColumns: [telegramChats.id],
      name: 'telegram_active_notification_groups_notification_settings_chat_fk'
    })
  ]
);

export const telegramNotificationSettings = pgTable('telegram_notification_settings', {
  disableMentionNotifications: boolean('disable_mention_notifications').notNull(),
  disablePinnedMessageNotifications: boolean('disable_pinned_message_notifications').notNull(),
  muteFor: integer('mute_for').notNull(),
  muteStories: boolean('mute_stories').notNull(),
  scopeKey: text('scope_key').primaryKey(),
  showPreview: boolean('show_preview').notNull(),
  showStoryPoster: boolean('show_story_poster').notNull(),
  soundId: bigintText('sound_id').notNull(),
  storySoundId: bigintText('story_sound_id').notNull(),
  useDefaultMuteStories: boolean('use_default_mute_stories').notNull()
});

export const telegramActiveNotifications = pgTable(
  'telegram_active_notifications',
  {
    callId: integer('call_id'),
    date: timestamp('date', { withTimezone: true }).notNull(),
    groupId: integer('group_id').notNull(),
    id: integer('id').notNull(),
    isSilent: boolean('is_silent').notNull(),
    messageChatId: bigintText('message_chat_id'),
    messageId: bigintText('message_id'),
    pushContent: jsonb('push_content').$type<JsonValue>(),
    pushIsOutgoing: boolean('push_is_outgoing'),
    pushMessageId: bigintText('push_message_id'),
    pushSenderId: jsonb('push_sender_id').$type<JsonValue>(),
    pushSenderName: text('push_sender_name'),
    showPreview: boolean('show_preview'),
    type: text('type').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.groupId, table.id],
      name: 'telegram_active_notifications_pk'
    }),
    foreignKey({
      columns: [table.groupId],
      foreignColumns: [telegramActiveNotificationGroups.id],
      name: 'telegram_active_notifications_group_fk'
    }),
    foreignKey({
      columns: [table.messageChatId, table.messageId],
      foreignColumns: [telegramMessages.chatId, telegramMessages.id],
      name: 'telegram_active_notifications_message_fk'
    }),
    foreignKey({
      columns: [table.callId],
      foreignColumns: [telegramCalls.id],
      name: 'telegram_active_notifications_call_fk'
    })
  ]
);

export const telegramPolls = pgTable('telegram_polls', {
  allowsMultipleAnswers: boolean('allows_multiple_answers').notNull(),
  allowsRevoting: boolean('allows_revoting').notNull(),
  canGetVoters: boolean('can_get_voters').notNull(),
  closeDate: timestamp('close_date', { withTimezone: true }).notNull(),
  countryCodes: jsonb('country_codes').$type<JsonValue>().notNull(),
  id: bigintText('id').primaryKey(),
  isAnonymous: boolean('is_anonymous').notNull(),
  isClosed: boolean('is_closed').notNull(),
  membersOnly: boolean('members_only').notNull(),
  openPeriod: integer('open_period').notNull(),
  optionOrder: jsonb('option_order').$type<JsonValue>().notNull(),
  options: jsonb('options').$type<JsonValue>().notNull(),
  question: jsonb('question').$type<JsonValue>().notNull(),
  recentVoterIds: jsonb('recent_voter_ids').$type<JsonValue>().notNull(),
  totalVoterCount: integer('total_voter_count').notNull(),
  type: jsonb('type').$type<JsonValue>().notNull(),
  voteRestrictionReason: jsonb('vote_restriction_reason').$type<JsonValue>().notNull()
});

export const telegramPollOptions = pgTable(
  'telegram_poll_options',
  {
    additionDate: timestamp('addition_date', { withTimezone: true }).notNull(),
    author: jsonb('author').$type<JsonValue>().notNull(),
    id: text('id').notNull(),
    isBeingChosen: boolean('is_being_chosen').notNull(),
    isChosen: boolean('is_chosen').notNull(),
    media: jsonb('media').$type<JsonValue>().notNull(),
    optionPosition: integer('option_position').notNull(),
    pollId: bigintText('poll_id').notNull(),
    recentVoterIds: jsonb('recent_voter_ids').$type<JsonValue>().notNull(),
    text: jsonb('text').$type<JsonValue>().notNull(),
    votePercentage: integer('vote_percentage').notNull(),
    voterCount: integer('voter_count').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.pollId, table.optionPosition],
      name: 'telegram_poll_options_pk'
    }),
    foreignKey({
      columns: [table.pollId],
      foreignColumns: [telegramPolls.id],
      name: 'telegram_poll_options_poll_fk'
    })
  ]
);

export const telegramPollAnswerOptions = pgTable(
  'telegram_poll_answer_options',
  {
    optionId: text('option_id').notNull(),
    optionPosition: integer('option_position').notNull(),
    pollId: bigintText('poll_id').notNull(),
    voterId: text('voter_id').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.pollId, table.voterId, table.optionPosition],
      name: 'telegram_poll_answer_options_pk'
    })
  ]
);

export const telegramProfilePhotos = pgTable(
  'telegram_profile_photos',
  {
    bigFileId: integer('big_file_id').notNull(),
    hasAnimation: boolean('has_animation').notNull(),
    id: bigintText('id').notNull(),
    isPersonal: boolean('is_personal').notNull(),
    minithumbnail: jsonb('minithumbnail').$type<JsonValue>().notNull(),
    smallFileId: integer('small_file_id').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: 'telegram_profile_photos_pk'
    }),
    foreignKey({
      columns: [table.smallFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_profile_photos_small_file_fk'
    }),
    foreignKey({
      columns: [table.bigFileId],
      foreignColumns: [telegramFiles.id],
      name: 'telegram_profile_photos_big_file_fk'
    })
  ]
);

export const telegramQuickReplyMessages = pgTable('telegram_quick_reply_messages', {
  canBeEdited: boolean('can_be_edited').notNull(),
  content: jsonb('content').$type<JsonValue>().notNull(),
  id: bigintText('id').primaryKey(),
  mediaAlbumId: bigintText('media_album_id'),
  order: integer('order').notNull(),
  replyMarkup: jsonb('reply_markup').$type<JsonValue>().notNull(),
  replyToMessageId: bigintText('reply_to_message_id'),
  sendingState: jsonb('sending_state').$type<JsonValue>().notNull(),
  shortcutId: integer('shortcut_id').notNull(),
  viaBotUserId: bigintText('via_bot_user_id').notNull()
});

export const telegramQuickReplyShortcuts = pgTable(
  'telegram_quick_reply_shortcuts',
  {
    firstMessageId: bigintText('first_message_id').notNull(),
    id: integer('id').notNull(),
    messageCount: integer('message_count').notNull(),
    name: text('name').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: 'telegram_quick_reply_shortcuts_pk'
    }),
    foreignKey({
      columns: [table.firstMessageId],
      foreignColumns: [telegramQuickReplyMessages.id],
      name: 'telegram_quick_reply_shortcuts_first_message_fk'
    })
  ]
);

export const telegramSavedMessagesTags = pgTable(
  'telegram_saved_messages_tags',
  {
    count: integer('count').notNull(),
    label: text('label').notNull(),
    savedMessagesTopicId: bigintText('saved_messages_topic_id').notNull(),
    tag: text('tag').notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.savedMessagesTopicId, table.tag],
      name: 'telegram_saved_messages_tags_pk'
    })
  ]
);

export const telegramSavedMessagesTopics = pgTable(
  'telegram_saved_messages_topics',
  {
    draftMessage: jsonb('draft_message').$type<JsonValue>(),
    id: bigintText('id').notNull(),
    isPinned: boolean('is_pinned').notNull(),
    lastMessageChatId: bigintText('last_message_chat_id'),
    lastMessageId: bigintText('last_message_id'),
    order: bigintText('order').notNull(),
    type: jsonb('type').$type<JsonValue>().notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: 'telegram_saved_messages_topics_pk'
    }),
    foreignKey({
      columns: [table.lastMessageChatId, table.lastMessageId],
      foreignColumns: [telegramMessages.chatId, telegramMessages.id],
      name: 'telegram_saved_messages_topics_last_message_fk'
    })
  ]
);

export const telegramSecretChats = pgTable('telegram_secret_chats', {
  id: integer('id').primaryKey(),
  isOutbound: boolean('is_outbound').notNull(),
  keyHash: byteaText('key_hash').notNull(),
  layer: integer('layer').notNull(),
  state: jsonb('state').$type<JsonValue>().notNull(),
  userId: bigintText('user_id').notNull()
});

export const telegramStarRevenueStatuses = pgTable('telegram_star_revenue_statuses', {
  availableAmount: jsonb('available_amount').$type<JsonValue>().notNull(),
  currentAmount: jsonb('current_amount').$type<JsonValue>().notNull(),
  nextWithdrawalIn: integer('next_withdrawal_in').notNull(),
  ownerId: text('owner_id').primaryKey(),
  totalAmount: jsonb('total_amount').$type<JsonValue>().notNull(),
  withdrawalEnabled: boolean('withdrawal_enabled').notNull()
});

export const telegramStickerSets = pgTable('telegram_sticker_sets', {
  emojis: jsonb('emojis').$type<JsonValue>().notNull(),
  id: bigintText('id').primaryKey(),
  isAllowedAsChatEmojiStatus: boolean('is_allowed_as_chat_emoji_status').notNull(),
  isArchived: boolean('is_archived').notNull(),
  isInstalled: boolean('is_installed').notNull(),
  isOfficial: boolean('is_official').notNull(),
  isOwned: boolean('is_owned').notNull(),
  isViewed: boolean('is_viewed').notNull(),
  name: text('name').notNull(),
  needsRepainting: boolean('needs_repainting').notNull(),
  stickerType: jsonb('sticker_type').$type<JsonValue>().notNull(),
  stickers: jsonb('stickers').$type<JsonValue>().notNull(),
  thumbnail: jsonb('thumbnail').$type<JsonValue>().notNull(),
  thumbnailOutline: jsonb('thumbnail_outline').$type<JsonValue>().notNull(),
  title: text('title').notNull()
});

export const telegramStories = pgTable(
  'telegram_stories',
  {
    albumIds: jsonb('album_ids').$type<JsonValue>().notNull(),
    areas: jsonb('areas').$type<JsonValue>().notNull(),
    canBeAddedToAlbum: boolean('can_be_added_to_album').notNull(),
    canBeDeleted: boolean('can_be_deleted').notNull(),
    canBeEdited: boolean('can_be_edited').notNull(),
    canBeForwarded: boolean('can_be_forwarded').notNull(),
    canBeReplied: boolean('can_be_replied').notNull(),
    canGetInteractions: boolean('can_get_interactions').notNull(),
    canGetStatistics: boolean('can_get_statistics').notNull(),
    canPostStoryResult: jsonb('can_post_story_result').$type<JsonValue>(),
    canSetPrivacySettings: boolean('can_set_privacy_settings').notNull(),
    canToggleIsPostedToChatPage: boolean('can_toggle_is_posted_to_chat_page').notNull(),
    caption: jsonb('caption').$type<JsonValue>().notNull(),
    chosenReactionType: jsonb('chosen_reaction_type').$type<JsonValue>().notNull(),
    content: jsonb('content').$type<JsonValue>().notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    error: jsonb('error').$type<JsonValue>(),
    hasExpiredViewers: boolean('has_expired_viewers').notNull(),
    id: integer('id').notNull(),
    interactionInfo: jsonb('interaction_info').$type<JsonValue>().notNull(),
    isBeingEdited: boolean('is_being_edited').notNull(),
    isBeingPosted: boolean('is_being_posted').notNull(),
    isEdited: boolean('is_edited').notNull(),
    isPostedToChatPage: boolean('is_posted_to_chat_page').notNull(),
    isVisibleOnlyForSelf: boolean('is_visible_only_for_self').notNull(),
    posterChatId: bigintText('poster_chat_id').notNull(),
    posterId: jsonb('poster_id').$type<JsonValue>().notNull(),
    privacySettings: jsonb('privacy_settings').$type<JsonValue>().notNull(),
    repostInfo: jsonb('repost_info').$type<JsonValue>().notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.posterChatId, table.id],
      name: 'telegram_stories_pk'
    })
  ]
);

export const telegramSuggestedActions = pgTable('telegram_suggested_actions', {
  actionKey: text('action_key').primaryKey(),
  authorizationDelay: integer('authorization_delay'),
  canBeHidden: boolean('can_be_hidden'),
  description: jsonb('description').$type<JsonValue>(),
  managePremiumSubscriptionUrl: text('manage_premium_subscription_url'),
  name: text('name'),
  supergroupId: bigintText('supergroup_id'),
  title: jsonb('title').$type<JsonValue>(),
  url: text('url')
});

export const telegramSupergroups = pgTable(
  'telegram_supergroups',
  {
    activeStoryState: jsonb('active_story_state').$type<JsonValue>(),
    administratorCount: integer('administrator_count'),
    bannedCount: integer('banned_count'),
    boostLevel: integer('boost_level').notNull(),
    botCommands: jsonb('bot_commands').$type<JsonValue>(),
    botVerification: jsonb('bot_verification').$type<JsonValue>(),
    canEnablePaidMessages: boolean('can_enable_paid_messages'),
    canEnablePaidReaction: boolean('can_enable_paid_reaction'),
    canGetMembers: boolean('can_get_members'),
    canGetRevenueStatistics: boolean('can_get_revenue_statistics'),
    canGetStarRevenueStatistics: boolean('can_get_star_revenue_statistics'),
    canGetStatistics: boolean('can_get_statistics'),
    canHaveSponsoredMessages: boolean('can_have_sponsored_messages'),
    canHideMembers: boolean('can_hide_members'),
    canSendGift: boolean('can_send_gift'),
    canSetLocation: boolean('can_set_location'),
    canSetStickerSet: boolean('can_set_sticker_set'),
    canToggleAggressiveAntiSpam: boolean('can_toggle_aggressive_anti_spam'),
    customEmojiStickerSetId: bigintText('custom_emoji_sticker_set_id'),
    date: timestamp('date', { withTimezone: true }).notNull(),
    description: text('description'),
    directMessagesChatId: bigintText('direct_messages_chat_id'),
    giftCount: integer('gift_count'),
    hasAggressiveAntiSpamEnabled: boolean('has_aggressive_anti_spam_enabled'),
    hasAutomaticTranslation: boolean('has_automatic_translation').notNull(),
    hasDirectMessagesGroup: boolean('has_direct_messages_group').notNull(),
    hasForumTabs: boolean('has_forum_tabs').notNull(),
    hasHiddenMembers: boolean('has_hidden_members'),
    hasLinkedChat: boolean('has_linked_chat').notNull(),
    hasLocation: boolean('has_location').notNull(),
    hasPaidMediaAllowed: boolean('has_paid_media_allowed'),
    hasPinnedStories: boolean('has_pinned_stories'),
    id: bigintText('id').notNull(),
    inviteLink: jsonb('invite_link').$type<JsonValue>(),
    isAdministeredDirectMessagesGroup: boolean('is_administered_direct_messages_group').notNull(),
    isAllHistoryAvailable: boolean('is_all_history_available'),
    isBroadcastGroup: boolean('is_broadcast_group').notNull(),
    isChannel: boolean('is_channel').notNull(),
    isDirectMessagesGroup: boolean('is_direct_messages_group').notNull(),
    isForum: boolean('is_forum').notNull(),
    isSlowModeEnabled: boolean('is_slow_mode_enabled').notNull(),
    joinByRequest: boolean('join_by_request').notNull(),
    joinToSendMessages: boolean('join_to_send_messages').notNull(),
    linkedChatId: bigintText('linked_chat_id'),
    location: jsonb('location').$type<JsonValue>(),
    mainProfileTab: jsonb('main_profile_tab').$type<JsonValue>(),
    memberCount: integer('member_count'),
    myBoostCount: integer('my_boost_count'),
    outgoingPaidMessageStarCount: bigintText('outgoing_paid_message_star_count'),
    paidMessageStarCount: bigintText('paid_message_star_count').notNull(),
    photoId: bigintText('photo_id'),
    restrictedCount: integer('restricted_count'),
    restrictionInfo: jsonb('restriction_info').$type<JsonValue>(),
    showMessageSender: boolean('show_message_sender').notNull(),
    signMessages: boolean('sign_messages').notNull(),
    slowModeDelay: integer('slow_mode_delay'),
    slowModeDelayExpiresIn: doublePrecision('slow_mode_delay_expires_in'),
    status: jsonb('status').$type<JsonValue>().notNull(),
    stickerSetId: bigintText('sticker_set_id'),
    unrestrictBoostCount: integer('unrestrict_boost_count'),
    upgradedFromBasicGroupId: bigintText('upgraded_from_basic_group_id'),
    upgradedFromMaxMessageId: bigintText('upgraded_from_max_message_id'),
    usernames: jsonb('usernames').$type<JsonValue>(),
    verificationStatus: jsonb('verification_status').$type<JsonValue>()
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: 'telegram_supergroups_pk'
    }),
    foreignKey({
      columns: [table.photoId],
      foreignColumns: [telegramChatPhotos.id],
      name: 'telegram_supergroups_photo_id_fk'
    })
  ]
);

export const telegramTermsOfService = pgTable('telegram_terms_of_service', {
  minUserAge: integer('min_user_age').notNull(),
  showPopup: boolean('show_popup').notNull(),
  termsOfServiceId: text('terms_of_service_id').primaryKey(),
  text: jsonb('text').$type<JsonValue>().notNull()
});

export const telegramTextCompositionStyles = pgTable('telegram_text_composition_styles', {
  creatorUserId: bigintText('creator_user_id'),
  customEmojiId: bigintText('custom_emoji_id'),
  englishExample: jsonb('english_example').$type<JsonValue>(),
  installCount: integer('install_count'),
  isCreator: boolean('is_creator').notNull(),
  isCustom: boolean('is_custom').notNull(),
  name: text('name').primaryKey(),
  prompt: text('prompt'),
  title: text('title').notNull()
});

export const telegramUpgradedGifts = pgTable('telegram_upgraded_gifts', {
  backdrop: jsonb('backdrop').$type<JsonValue>().notNull(),
  canSendPurchaseOffer: boolean('can_send_purchase_offer').notNull(),
  colors: jsonb('colors').$type<JsonValue>().notNull(),
  craftProbabilityPerMille: integer('craft_probability_per_mille').notNull(),
  giftAddress: text('gift_address'),
  hostId: jsonb('host_id').$type<JsonValue>().notNull(),
  id: bigintText('id').primaryKey(),
  isBurned: boolean('is_burned').notNull(),
  isCrafted: boolean('is_crafted').notNull(),
  isPremium: boolean('is_premium').notNull(),
  isThemeAvailable: boolean('is_theme_available').notNull(),
  maxUpgradedCount: integer('max_upgraded_count').notNull(),
  model: jsonb('model').$type<JsonValue>().notNull(),
  name: text('name').notNull(),
  number: integer('number').notNull(),
  originalDetails: jsonb('original_details').$type<JsonValue>().notNull(),
  ownerAddress: text('owner_address'),
  ownerId: jsonb('owner_id').$type<JsonValue>().notNull(),
  ownerName: text('owner_name').notNull(),
  publisherChatId: bigintText('publisher_chat_id'),
  regularGiftId: bigintText('regular_gift_id').notNull(),
  resaleParameters: jsonb('resale_parameters').$type<JsonValue>().notNull(),
  symbol: jsonb('symbol').$type<JsonValue>().notNull(),
  title: text('title').notNull(),
  totalUpgradedCount: integer('total_upgraded_count').notNull(),
  usedThemeChatId: bigintText('used_theme_chat_id'),
  valueAmount: bigintText('value_amount').notNull(),
  valueCurrency: text('value_currency').notNull(),
  valueUsdAmount: bigintText('value_usd_amount').notNull()
});

export const telegramUserPrivacySettingRules = pgTable('telegram_user_privacy_setting_rules', {
  rules: jsonb('rules').$type<JsonValue>().notNull(),
  settingKey: text('setting_key').primaryKey()
});

export const telegramUsers = pgTable(
  'telegram_users',
  {
    accentColorId: integer('accent_color_id'),
    activeStoryState: jsonb('active_story_state').$type<JsonValue>(),
    addedToAttachmentMenu: boolean('added_to_attachment_menu'),
    backgroundCustomEmojiId: bigintText('background_custom_emoji_id'),
    bio: jsonb('bio').$type<JsonValue>(),
    birthdate: jsonb('birthdate').$type<JsonValue>(),
    blockList: jsonb('block_list').$type<JsonValue>(),
    botInfo: jsonb('bot_info').$type<JsonValue>(),
    botVerification: jsonb('bot_verification').$type<JsonValue>(),
    businessInfo: jsonb('business_info').$type<JsonValue>(),
    canBeCalled: boolean('can_be_called'),
    emojiStatus: jsonb('emoji_status').$type<JsonValue>(),
    firstName: text('first_name'),
    firstProfileAudio: jsonb('first_profile_audio').$type<JsonValue>(),
    giftCount: integer('gift_count'),
    giftSettings: jsonb('gift_settings').$type<JsonValue>(),
    groupInCommonCount: integer('group_in_common_count'),
    hasPostedToProfileStories: boolean('has_posted_to_profile_stories'),
    hasPrivateCalls: boolean('has_private_calls'),
    hasPrivateForwards: boolean('has_private_forwards'),
    hasRestrictedVoiceAndVideoNoteMessages: boolean('has_restricted_voice_and_video_note_messages'),
    hasSponsoredMessagesEnabled: boolean('has_sponsored_messages_enabled'),
    haveAccess: boolean('have_access'),
    id: bigintText('id').notNull(),
    incomingPaidMessageStarCount: bigintText('incoming_paid_message_star_count'),
    isCloseFriend: boolean('is_close_friend'),
    isContact: boolean('is_contact'),
    isMutualContact: boolean('is_mutual_contact'),
    isPremium: boolean('is_premium'),
    isSupport: boolean('is_support'),
    languageCode: text('language_code'),
    lastName: text('last_name'),
    mainProfileTab: jsonb('main_profile_tab').$type<JsonValue>(),
    needPhoneNumberPrivacyException: boolean('need_phone_number_privacy_exception'),
    note: jsonb('note').$type<JsonValue>(),
    outgoingPaidMessageStarCount: bigintText('outgoing_paid_message_star_count'),
    paidMessageStarCount: bigintText('paid_message_star_count'),
    pendingRating: jsonb('pending_rating').$type<JsonValue>(),
    pendingRatingDate: timestamp('pending_rating_date', { withTimezone: true }),
    personalChatId: bigintText('personal_chat_id'),
    personalPhotoId: bigintText('personal_photo_id'),
    phoneNumber: text('phone_number'),
    photoId: bigintText('photo_id'),
    profileAccentColorId: integer('profile_accent_color_id'),
    profileBackgroundCustomEmojiId: bigintText('profile_background_custom_emoji_id'),
    profilePhotoId: bigintText('profile_photo_id'),
    publicPhotoId: bigintText('public_photo_id'),
    rating: jsonb('rating').$type<JsonValue>(),
    restrictionInfo: jsonb('restriction_info').$type<JsonValue>(),
    restrictsNewChats: boolean('restricts_new_chats'),
    setChatBackground: boolean('set_chat_background'),
    status: jsonb('status').$type<JsonValue>(),
    supportsVideoCalls: boolean('supports_video_calls'),
    type: jsonb('type').$type<JsonValue>(),
    upgradedGiftColors: jsonb('upgraded_gift_colors').$type<JsonValue>(),
    usernames: jsonb('usernames').$type<JsonValue>(),
    usesUnofficialApp: boolean('uses_unofficial_app'),
    verificationStatus: jsonb('verification_status').$type<JsonValue>()
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: 'telegram_users_pk'
    }),
    foreignKey({
      columns: [table.profilePhotoId],
      foreignColumns: [telegramProfilePhotos.id],
      name: 'telegram_users_profile_photo_fk'
    }),
    foreignKey({
      columns: [table.personalPhotoId],
      foreignColumns: [telegramChatPhotos.id],
      name: 'telegram_users_personal_photo_id_fk'
    }),
    foreignKey({
      columns: [table.photoId],
      foreignColumns: [telegramChatPhotos.id],
      name: 'telegram_users_photo_id_fk'
    }),
    foreignKey({
      columns: [table.publicPhotoId],
      foreignColumns: [telegramChatPhotos.id],
      name: 'telegram_users_public_photo_id_fk'
    })
  ]
);
