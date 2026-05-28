import type { JsonObject } from '@agentg/events/json';

import {
  telegramActiveNotificationRef,
  telegramChatRef,
  telegramDefaultBackgroundRef,
  telegramEmojiChatThemesRef,
  telegramMessageRef,
  telegramQuickReplyMessageRef,
  telegramStickerSetRef,
  telegramStoryRef,
  telegramUserRef
} from './modelRefs.js';
import { telegramWireFileOrUndefined, type TelegramWireFile } from './tdlib/wire.js';
import type {
  ExtractedTelegramFileSlot,
  TelegramFileOwner,
  TelegramFileMediaKind,
  TelegramFileRenderKind
} from './fileTypes.js';

export type TelegramFileSlotUpdate = {
  chat?: {
    chat: JsonObject;
    id: string;
  };
  chatPhoto?: {
    chatId: string;
    photo: JsonObject | null;
  };
  chatTheme?: {
    chatId: string;
    theme: JsonObject | null;
  };
  chatBackground?: {
    background: JsonObject;
    chatId: string;
  };
  defaultBackground?: {
    background: JsonObject | null;
    key: string;
  };
  emojiChatThemes?: {
    themes: JsonObject[];
  };
  contentUpdate?: {
    chatId: string;
    content?: JsonObject;
    messageId: string;
  };
  message?: {
    chatId: string;
    content?: JsonObject;
    messageId: string;
  };
  notificationGroups?: {
    groups: JsonObject[];
  };
  quickReplyMessage?: {
    content?: JsonObject;
    messageId: string;
  };
  stickerSet?: {
    id: string;
    stickerSet: JsonObject;
  };
  stickerSetInfos?: {
    sets: JsonObject[];
  };
  story?: {
    posterChatId: string;
    story: JsonObject;
    storyId: number;
  };
  userFullInfo?: {
    info: JsonObject;
    userId: string;
  };
};

type TdFileFacts = {
  byteSize: number | null;
  file: TelegramWireFile;
  tdlibFileId: number;
};

type ContentFileOwner = {
  owner: TelegramFileOwner;
};

export function extractTelegramFileSlots(
  update: TelegramFileSlotUpdate
): ExtractedTelegramFileSlot[] {
  return [
    ...(update.chat === undefined ? [] : extractChatFileSlots(update.chat.id, update.chat.chat)),
    ...(update.chatPhoto === undefined
      ? []
      : extractChatPhotoFileSlots(update.chatPhoto.chatId, update.chatPhoto.photo)),
    ...(update.chatBackground === undefined
      ? []
      : extractChatBackgroundFileSlots(
          update.chatBackground.chatId,
          update.chatBackground.background
        )),
    ...(update.defaultBackground === undefined
      ? []
      : extractDefaultBackgroundFileSlots(
          update.defaultBackground.key,
          update.defaultBackground.background
        )),
    ...(update.emojiChatThemes === undefined
      ? []
      : extractEmojiChatThemeFileSlots(update.emojiChatThemes.themes)),
    ...(update.chatTheme === undefined
      ? []
      : extractChatThemeFileSlots(update.chatTheme.chatId, update.chatTheme.theme)),
    ...(update.message === undefined
      ? []
      : extractMessageFileSlots(
          {
            owner: telegramMessageRef({
              chatId: update.message.chatId,
              messageId: update.message.messageId
            })
          },
          asPlainRecord(update.message.content)
        )),
    ...(update.contentUpdate === undefined
      ? []
      : extractMessageFileSlots(
          {
            owner: telegramMessageRef({
              chatId: update.contentUpdate.chatId,
              messageId: update.contentUpdate.messageId
            })
          },
          asPlainRecord(update.contentUpdate.content)
        )),
    ...(update.notificationGroups === undefined
      ? []
      : extractNotificationGroupFileSlots(update.notificationGroups.groups)),
    ...(update.quickReplyMessage === undefined
      ? []
      : extractMessageFileSlots(
          {
            owner: telegramQuickReplyMessageRef(update.quickReplyMessage.messageId)
          },
          asPlainRecord(update.quickReplyMessage.content)
        )),
    ...(update.stickerSet === undefined
      ? []
      : extractStickerSetFileSlots(update.stickerSet.id, update.stickerSet.stickerSet)),
    ...(update.stickerSetInfos === undefined
      ? []
      : extractStickerSetInfoFileSlots(update.stickerSetInfos.sets)),
    ...(update.story === undefined
      ? []
      : extractStoryFileSlots(update.story.posterChatId, update.story.storyId, update.story.story)),
    ...(update.userFullInfo === undefined
      ? []
      : extractNestedFileSlots(
          {
            owner: telegramUserRef(update.userFullInfo.userId)
          },
          update.userFullInfo.info,
          'full_info'
        ))
  ];
}

function extractChatFileSlots(chatId: string, chat: JsonObject): ExtractedTelegramFileSlot[] {
  const photo = asPlainRecord(chat.photo);
  return [
    chatAvatarSlot(chatId, 'avatar.small', photo?.small),
    chatAvatarSlot(chatId, 'avatar.big', photo?.big)
  ].filter(isDefined);
}

function chatAvatarSlot(
  chatId: string,
  slotKey: string,
  value: unknown
): ExtractedTelegramFileSlot | undefined {
  const file = tdFileFacts(value);
  if (file === null) {
    return undefined;
  }
  return fileSlot({
    facts: file,
    mediaKind: 'avatar',
    mimeType: 'image/jpeg',
    owner: telegramChatRef(chatId),
    renderKind: 'image',
    slotKey
  });
}

function extractChatPhotoFileSlots(
  chatId: string,
  photo: JsonObject | null
): ExtractedTelegramFileSlot[] {
  if (photo === null) {
    return [];
  }

  return [
    chatAvatarSlot(chatId, 'avatar.small', photo.small),
    chatAvatarSlot(chatId, 'avatar.big', photo.big)
  ].filter(isDefined);
}

function extractChatBackgroundFileSlots(
  chatId: string,
  chatBackground: JsonObject
): ExtractedTelegramFileSlot[] {
  const background = asPlainRecord(chatBackground.background);
  const owner: ContentFileOwner = {
    owner: telegramChatRef(chatId)
  };

  return extractBackgroundFileSlots(owner, background, 'background');
}

function extractDefaultBackgroundFileSlots(
  key: string,
  background: JsonObject | null
): ExtractedTelegramFileSlot[] {
  if (background === null) {
    return [];
  }

  return extractBackgroundFileSlots(
    {
      owner: telegramDefaultBackgroundRef(key)
    },
    background,
    'background'
  );
}

function extractEmojiChatThemeFileSlots(themes: JsonObject[]): ExtractedTelegramFileSlot[] {
  const owner: ContentFileOwner = {
    owner: telegramEmojiChatThemesRef()
  };
  const slots: ExtractedTelegramFileSlot[] = [];

  for (const theme of themes) {
    const name = safeString(theme.name);
    if (name === null) {
      continue;
    }

    const lightSettings = asPlainRecord(theme.light_settings);
    const darkSettings = asPlainRecord(theme.dark_settings);
    slots.push(
      ...extractBackgroundFileSlots(
        owner,
        asPlainRecord(lightSettings?.background),
        `theme.${name}.light.background`
      ),
      ...extractBackgroundFileSlots(
        owner,
        asPlainRecord(darkSettings?.background),
        `theme.${name}.dark.background`
      )
    );
  }

  return slots;
}

function extractChatThemeFileSlots(
  chatId: string,
  theme: JsonObject | null
): ExtractedTelegramFileSlot[] {
  if (theme?._ !== 'chatThemeGift') {
    return [];
  }

  const owner: ContentFileOwner = {
    owner: telegramChatRef(chatId)
  };
  const giftTheme = asPlainRecord(theme.gift_theme);
  const gift = asPlainRecord(giftTheme?.gift);
  const model = asPlainRecord(gift?.model);
  const symbol = asPlainRecord(gift?.symbol);
  const lightSettings = asPlainRecord(giftTheme?.light_settings);
  const darkSettings = asPlainRecord(giftTheme?.dark_settings);

  return [
    ...extractStickerFileSlots(owner, asPlainRecord(model?.sticker), 'theme.gift.model.sticker'),
    ...extractStickerFileSlots(owner, asPlainRecord(symbol?.sticker), 'theme.gift.symbol.sticker'),
    ...extractBackgroundFileSlots(
      owner,
      asPlainRecord(lightSettings?.background),
      'theme.light.background'
    ),
    ...extractBackgroundFileSlots(
      owner,
      asPlainRecord(darkSettings?.background),
      'theme.dark.background'
    )
  ];
}

function extractBackgroundFileSlots(
  owner: ContentFileOwner,
  background: Record<string, unknown> | undefined,
  slotKeyPrefix: string
): ExtractedTelegramFileSlot[] {
  const document = asPlainRecord(background?.document);
  const slots: ExtractedTelegramFileSlot[] = [];
  const documentFacts = tdFileFacts(document?.document);

  if (documentFacts !== null) {
    slots.push(
      fileSlot({
        facts: documentFacts,
        fileName: safeString(document?.file_name),
        mediaKind: 'document',
        mimeType: safeString(document?.mime_type),
        owner: owner.owner,
        renderKind: 'download',
        slotKey: `${slotKeyPrefix}.document.file`
      })
    );
  }

  const thumbnail = thumbnailSlot(
    owner,
    document?.thumbnail,
    `${slotKeyPrefix}.document.thumbnail`
  );
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }

  return slots;
}

function extractMessageFileSlots(
  owner: ContentFileOwner,
  content: Record<string, unknown> | undefined
): ExtractedTelegramFileSlot[] {
  switch (content?._) {
    case 'messageAudio':
      return extractMessageAudioSlots(owner, content);
    case 'messagePhoto':
      return extractMessagePhotoSlots(owner, content);
    case 'messageSticker':
      return extractMessageStickerSlots(owner, content);
    case 'messageVideo':
      return extractMessageVideoSlots(owner, content, 'video');
    case 'messageVideoNote':
      return extractMessageVideoNoteSlots(owner, content);
    case 'messageVoiceNote':
      return extractMessageVoiceNoteSlots(owner, content);
    case 'messageAnimation':
      return extractMessageVideoSlots(owner, content, 'animation');
    case 'messageDocument':
      return extractMessageDocumentSlots(owner, content);
    default:
      return [];
  }
}

function extractMessagePhotoSlots(
  owner: ContentFileOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const photo = asPlainRecord(content.photo);
  const size = chooseLargestPhotoSize(asRecordArray(photo?.sizes));
  const facts = tdFileFacts(size?.photo);
  if (size === undefined || facts === null) {
    return [];
  }
  return [
    fileSlot({
      facts,
      height: safeInteger(size.height),
      mediaKind: 'photo',
      mimeType: 'image/jpeg',
      owner: owner.owner,
      renderKind: 'image',
      slotKey: 'content.photo.0',
      width: safeInteger(size.width)
    })
  ];
}

function extractMessageVideoSlots(
  owner: ContentFileOwner,
  content: Record<string, unknown>,
  field: 'animation' | 'video'
): ExtractedTelegramFileSlot[] {
  const video = asPlainRecord(content[field]);
  const slots: ExtractedTelegramFileSlot[] = [];
  const facts = tdFileFacts(video?.[field]);
  if (facts !== null) {
    slots.push(
      fileSlot({
        durationSeconds: safeInteger(video?.duration),
        facts,
        fileName: safeString(video?.file_name),
        height: safeInteger(video?.height),
        mediaKind: 'video',
        mimeType: safeString(video?.mime_type) ?? 'video/mp4',
        owner: owner.owner,
        renderKind: 'video',
        slotKey: 'content.video.file',
        width: safeInteger(video?.width)
      })
    );
  }
  const thumbnail = thumbnailSlot(owner, video?.thumbnail, 'content.video.thumbnail');
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }
  return slots;
}

function extractMessageVideoNoteSlots(
  owner: ContentFileOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const videoNote = asPlainRecord(content.video_note);
  const slots: ExtractedTelegramFileSlot[] = [];
  const facts = tdFileFacts(videoNote?.video);
  if (facts !== null) {
    slots.push(
      fileSlot({
        durationSeconds: safeInteger(videoNote?.duration),
        facts,
        height: safeInteger(videoNote?.length),
        mediaKind: 'video',
        mimeType: 'video/mp4',
        owner: owner.owner,
        renderKind: 'video',
        slotKey: 'content.video.file',
        width: safeInteger(videoNote?.length)
      })
    );
  }
  const thumbnail = thumbnailSlot(owner, videoNote?.thumbnail, 'content.video.thumbnail');
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }
  return slots;
}

function extractMessageDocumentSlots(
  owner: ContentFileOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const document = asPlainRecord(content.document);
  const slots: ExtractedTelegramFileSlot[] = [];
  const facts = tdFileFacts(document?.document);
  if (facts !== null) {
    slots.push(
      fileSlot({
        facts,
        fileName: safeString(document?.file_name),
        mediaKind: 'document',
        mimeType: safeString(document?.mime_type),
        owner: owner.owner,
        renderKind: 'download',
        slotKey: 'content.document.file'
      })
    );
  }
  const thumbnail = thumbnailSlot(owner, document?.thumbnail, 'content.document.thumbnail');
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }
  return slots;
}

function extractMessageVoiceNoteSlots(
  owner: ContentFileOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const voiceNote = asPlainRecord(content.voice_note);
  const facts = tdFileFacts(voiceNote?.voice);
  if (facts === null) {
    return [];
  }
  return [
    fileSlot({
      durationSeconds: safeInteger(voiceNote?.duration),
      facts,
      mediaKind: 'voice',
      mimeType: safeString(voiceNote?.mime_type) ?? 'audio/ogg',
      owner: owner.owner,
      renderKind: 'audio',
      slotKey: 'content.voice.file'
    })
  ];
}

function extractMessageAudioSlots(
  owner: ContentFileOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const audio = asPlainRecord(content.audio);
  const slots: ExtractedTelegramFileSlot[] = [];
  const facts = tdFileFacts(audio?.audio);
  if (facts !== null) {
    slots.push(
      fileSlot({
        durationSeconds: safeInteger(audio?.duration),
        facts,
        fileName: safeString(audio?.file_name),
        mediaKind: 'document',
        mimeType: safeString(audio?.mime_type),
        owner: owner.owner,
        renderKind: 'audio',
        slotKey: 'content.audio.file'
      })
    );
  }
  const thumbnail = thumbnailSlot(owner, audio?.album_cover_thumbnail, 'content.audio.thumbnail');
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }
  return slots;
}

function extractMessageStickerSlots(
  owner: ContentFileOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const sticker = asPlainRecord(content.sticker);
  return extractStickerFileSlots(owner, sticker, 'content.sticker');
}

function extractStickerFileSlots(
  owner: ContentFileOwner,
  sticker: Record<string, unknown> | undefined,
  slotKeyPrefix: string
): ExtractedTelegramFileSlot[] {
  const slots: ExtractedTelegramFileSlot[] = [];
  const facts = tdFileFacts(sticker?.sticker);
  const renderKind = stickerRenderKind(sticker);
  if (facts !== null) {
    slots.push(
      fileSlot({
        facts,
        height: safeInteger(sticker?.height),
        mediaKind: stickerMediaKind(renderKind),
        mimeType: stickerMimeType(sticker),
        owner: owner.owner,
        renderKind,
        slotKey: `${slotKeyPrefix}.file`,
        width: safeInteger(sticker?.width)
      })
    );
  }
  const thumbnail = thumbnailSlot(owner, sticker?.thumbnail, `${slotKeyPrefix}.thumbnail`);
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }
  return slots;
}

function extractStickerSetFileSlots(
  stickerSetId: string,
  stickerSet: JsonObject
): ExtractedTelegramFileSlot[] {
  const owner: ContentFileOwner = {
    owner: telegramStickerSetRef(stickerSetId)
  };
  const slots: ExtractedTelegramFileSlot[] = [];
  const thumbnail = thumbnailSlot(owner, stickerSet.thumbnail, 'thumbnail');

  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }

  for (const [index, sticker] of asRecordArray(stickerSet.stickers).entries()) {
    slots.push(...extractStickerFileSlots(owner, sticker, `stickers.${String(index)}`));
  }

  return slots;
}

function extractStickerSetInfoFileSlots(stickerSets: JsonObject[]): ExtractedTelegramFileSlot[] {
  const slots: ExtractedTelegramFileSlot[] = [];

  for (const stickerSet of stickerSets) {
    const stickerSetId = safeString(stickerSet.id);
    if (stickerSetId === null) {
      continue;
    }
    const owner: ContentFileOwner = {
      owner: telegramStickerSetRef(stickerSetId)
    };
    const thumbnail = thumbnailSlot(owner, stickerSet.thumbnail, 'trending.thumbnail');
    if (thumbnail !== undefined) {
      slots.push(thumbnail);
    }

    for (const [index, sticker] of asRecordArray(stickerSet.covers).entries()) {
      slots.push(...extractStickerFileSlots(owner, sticker, `trending.covers.${String(index)}`));
    }
  }

  return slots;
}

function extractStoryFileSlots(
  posterChatId: string,
  storyId: number,
  story: JsonObject
): ExtractedTelegramFileSlot[] {
  const owner: ContentFileOwner = {
    owner: telegramStoryRef({ posterChatId, storyId })
  };
  const content = asPlainRecord(story.content);

  if (content?._ === 'storyContentPhoto') {
    return extractStoryPhotoSlots(owner, content);
  }
  if (content?._ === 'storyContentVideo') {
    return [
      ...extractStoryVideoSlots(owner, asPlainRecord(content.video), 'content.video'),
      ...extractStoryVideoSlots(
        owner,
        asPlainRecord(content.alternative_video),
        'content.alternative_video'
      )
    ];
  }

  return [];
}

function extractStoryPhotoSlots(
  owner: ContentFileOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const photo = asPlainRecord(content.photo);
  const size = chooseLargestPhotoSize(asRecordArray(photo?.sizes));
  const facts = tdFileFacts(size?.photo);
  if (size === undefined || facts === null) {
    return [];
  }
  return [
    fileSlot({
      facts,
      height: safeInteger(size.height),
      mediaKind: 'photo',
      mimeType: 'image/jpeg',
      owner: owner.owner,
      renderKind: 'image',
      slotKey: 'content.photo.0',
      width: safeInteger(size.width)
    })
  ];
}

function extractStoryVideoSlots(
  owner: ContentFileOwner,
  video: Record<string, unknown> | undefined,
  slotKeyPrefix: string
): ExtractedTelegramFileSlot[] {
  const slots: ExtractedTelegramFileSlot[] = [];
  const facts = tdFileFacts(video?.video);
  if (facts !== null) {
    slots.push(
      fileSlot({
        durationSeconds: safeInteger(video?.duration),
        facts,
        height: safeInteger(video?.height),
        mediaKind: 'video',
        mimeType: 'video/mp4',
        owner: owner.owner,
        renderKind: 'video',
        slotKey: `${slotKeyPrefix}.file`,
        width: safeInteger(video?.width)
      })
    );
  }

  const thumbnail = thumbnailSlot(owner, video?.thumbnail, `${slotKeyPrefix}.thumbnail`);
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }

  return slots;
}

function extractNestedFileSlots(
  owner: ContentFileOwner,
  value: unknown,
  slotKeyPrefix: string
): ExtractedTelegramFileSlot[] {
  const file = tdFileFacts(value);
  if (file !== null) {
    return [
      fileSlot({
        facts: file,
        mediaKind: 'document',
        owner: owner.owner,
        renderKind: 'download',
        slotKey: slotKeyPrefix
      })
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      extractNestedFileSlots(owner, item, `${slotKeyPrefix}.${String(index)}`)
    );
  }

  const record = asPlainRecord(value);
  if (record === undefined) {
    return [];
  }

  return Object.entries(record)
    .filter(([key]) => key !== '_')
    .flatMap(([key, nestedValue]) =>
      extractNestedFileSlots(owner, nestedValue, `${slotKeyPrefix}.${key}`)
    );
}

function thumbnailSlot(
  owner: ContentFileOwner,
  value: unknown,
  slotKey: string
): ExtractedTelegramFileSlot | undefined {
  const thumbnail = asPlainRecord(value);
  const facts = tdFileFacts(thumbnail?.file);
  if (facts === null) {
    return undefined;
  }
  return fileSlot({
    facts,
    height: safeInteger(thumbnail?.height),
    mediaKind: 'thumbnail',
    mimeType: 'image/jpeg',
    owner: owner.owner,
    renderKind: 'image',
    slotKey,
    width: safeInteger(thumbnail?.width)
  });
}

function extractNotificationGroupFileSlots(groups: JsonObject[]): ExtractedTelegramFileSlot[] {
  const slots: ExtractedTelegramFileSlot[] = [];

  for (const group of groups) {
    const groupId = safeTdlibId(group.id);
    for (const notification of asRecordArray(group.notifications)) {
      const type = asPlainRecord(notification.type);
      if (type?._ === 'notificationTypeNewMessage') {
        const message = asPlainRecord(type.message);
        const chatId = safeTdlibId(message?.chat_id);
        const messageId = safeTdlibId(message?.id);
        if (chatId !== null && messageId !== null) {
          slots.push(
            ...extractMessageFileSlots(
              {
                owner: telegramMessageRef({ chatId, messageId })
              },
              asPlainRecord(message?.content)
            )
          );
        }
      }

      if (type?._ === 'notificationTypeNewPushMessage') {
        const notificationId = safeTdlibId(notification.id);
        if (groupId !== null && notificationId !== null) {
          slots.push(
            ...extractMessageFileSlots(
              {
                owner: telegramActiveNotificationRef({
                  groupId,
                  notificationId
                })
              },
              pushContentAsMessageContent(asPlainRecord(type.content))
            )
          );
        }
      }
    }
  }

  return slots;
}

function pushContentAsMessageContent(
  content: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  switch (content?._) {
    case 'pushMessageContentAnimation':
      return {
        _: 'messageAnimation',
        animation: content.animation
      };
    case 'pushMessageContentAudio':
      return {
        _: 'messageAudio',
        audio: content.audio
      };
    case 'pushMessageContentDocument':
      return {
        _: 'messageDocument',
        document: content.document
      };
    case 'pushMessageContentPhoto':
      return {
        _: 'messagePhoto',
        photo: content.photo
      };
    case 'pushMessageContentSticker':
      return {
        _: 'messageSticker',
        sticker: content.sticker
      };
    case 'pushMessageContentVideo':
      return {
        _: 'messageVideo',
        video: content.video
      };
    case 'pushMessageContentVideoNote':
      return {
        _: 'messageVideoNote',
        video_note: content.video_note
      };
    case 'pushMessageContentVoiceNote':
      return {
        _: 'messageVoiceNote',
        voice_note: content.voice_note
      };
    default:
      return undefined;
  }
}

function fileSlot(input: {
  durationSeconds?: number | null;
  facts: TdFileFacts;
  fileName?: string | null;
  height?: number | null;
  mediaKind: TelegramFileMediaKind;
  mimeType?: string | null;
  owner: ExtractedTelegramFileSlot['owner'];
  renderKind: TelegramFileRenderKind;
  slotKey: string;
  width?: number | null;
}): ExtractedTelegramFileSlot {
  return {
    byteSize: input.facts.byteSize,
    durationSeconds: input.durationSeconds ?? null,
    file: input.facts.file,
    fileName: input.fileName ?? null,
    height: input.height ?? null,
    mediaKind: input.mediaKind,
    mimeType: input.mimeType ?? null,
    owner: input.owner,
    renderKind: input.renderKind,
    slotKey: input.slotKey,
    tdlibFileId: input.facts.tdlibFileId,
    width: input.width ?? null
  };
}

function tdFileFacts(value: unknown): TdFileFacts | null {
  const file = telegramWireFileOrUndefined(value);
  if (file === undefined) {
    return null;
  }

  const localDownloadedSize = safePositiveInteger(file.local.downloaded_size);
  return {
    byteSize:
      safePositiveInteger(file.size) ??
      safePositiveInteger(file.expected_size) ??
      (file.local.is_downloading_completed ? localDownloadedSize : null) ??
      null,
    file,
    tdlibFileId: file.id
  };
}

function chooseLargestPhotoSize(
  sizes: Record<string, unknown>[]
): Record<string, unknown> | undefined {
  return [...sizes].sort((left, right) => photoSizeScore(right) - photoSizeScore(left))[0];
}

function photoSizeScore(size: Record<string, unknown>): number {
  const photo = asPlainRecord(size.photo);
  return (
    (safeInteger(size.width) ?? 0) * (safeInteger(size.height) ?? 0) +
    (safePositiveInteger(photo?.size) ?? safePositiveInteger(photo?.expected_size) ?? 0)
  );
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asPlainRecord).filter(isDefined) : [];
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stickerMediaKind(renderKind: TelegramFileRenderKind): TelegramFileMediaKind {
  if (renderKind === 'image') {
    return 'photo';
  }
  if (renderKind === 'video') {
    return 'video';
  }
  return 'document';
}

function stickerMimeType(sticker: Record<string, unknown> | undefined): string {
  const format = asPlainRecord(sticker?.format);
  switch (format?._) {
    case 'stickerFormatWebp':
      return 'image/webp';
    case 'stickerFormatWebm':
      return 'video/webm';
    case 'stickerFormatTgs':
      return 'application/x-tgsticker';
    default:
      return 'application/octet-stream';
  }
}

function stickerRenderKind(sticker: Record<string, unknown> | undefined): TelegramFileRenderKind {
  const format = asPlainRecord(sticker?.format);
  switch (format?._) {
    case 'stickerFormatWebp':
      return 'image';
    case 'stickerFormatWebm':
      return 'video';
    default:
      return 'download';
  }
}

function safeTdlibId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : null;
}

function safeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function safePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
