import type { JsonValue } from '@agentg/framework';
import type { user as TdlibUser } from 'tdlib-types';

import type {
  DomainChange,
  UserFullInfoSavedChange,
  UserSavedChange,
  UserUpdatedChange
} from '../../domain/changes.js';
import type { ChatPhoto } from '../../domain/models/chatPhoto.js';
import type { FileState } from '../../domain/models/fileState.js';
import type { UserState } from '../../domain/models/user.js';
import { tdDate, tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import { chatPhotoFromTdlibChatPhoto, fileStatesFromTdlibChatPhoto } from './chatPhoto.js';

type UserStatusUpdate = UpdateByType<'updateUserStatus'>;
type UserFullInfoUpdate = UpdateByType<'updateUserFullInfo'>;
type UserFullInfo = UserFullInfoUpdate['user_full_info'];
type TdlibChatPhoto = NonNullable<UserFullInfo['photo']>;

export function savedUserChanges(user: TdlibUser): DomainChange[] {
  return [
    {
      kind: 'user.saved',
      user: userRecordFromTdlibUser(user)
    } satisfies UserSavedChange
  ];
}

export function userStatusChanges(update: UserStatusUpdate): DomainChange[] {
  return [
    {
      kind: 'user.updated',
      user: {
        id: String(update.user_id),
        status: tdJsonObject(update.status)
      }
    } satisfies UserUpdatedChange
  ];
}

export function userFullInfoChanges(update: UserFullInfoUpdate): DomainChange[] {
  const chatPhotos = userFullInfoChatPhotoModels(update.user_full_info);
  return [
    {
      kind: 'user.fullInfoSaved',
      info: {
        chatPhotos,
        files: userFullInfoFileStates(update.user_full_info),
        user: userFullInfoRecord(String(update.user_id), update.user_full_info)
      }
    } satisfies UserFullInfoSavedChange
  ];
}

export function userRecordFromTdlibUser(user: TdlibUser): UserState {
  return {
    firstName: user.first_name,
    id: String(user.id),
    isPremium: user.is_premium,
    lastName: user.last_name,
    type: tdJsonObject(user.type)
  };
}

function userFullInfoRecord(userId: string, info: UserFullInfo): UserState {
  return {
    bio: nullableJsonValue(info.bio),
    birthdate: nullableJsonValue(info.birthdate),
    blockList: nullableJsonValue(info.block_list),
    botInfo: nullableJsonValue(info.bot_info),
    botVerification: nullableJsonValue(info.bot_verification),
    businessInfo: nullableJsonValue(info.business_info),
    canBeCalled: info.can_be_called,
    firstProfileAudio: nullableJsonValue(info.first_profile_audio),
    giftCount: info.gift_count,
    giftSettings: requiredJsonValue(info.gift_settings),
    groupInCommonCount: info.group_in_common_count,
    hasPostedToProfileStories: info.has_posted_to_profile_stories,
    hasPrivateCalls: info.has_private_calls,
    hasPrivateForwards: info.has_private_forwards,
    hasRestrictedVoiceAndVideoNoteMessages: info.has_restricted_voice_and_video_note_messages,
    hasSponsoredMessagesEnabled: info.has_sponsored_messages_enabled,
    id: userId,
    incomingPaidMessageStarCount: String(info.incoming_paid_message_star_count),
    mainProfileTab: nullableJsonValue(info.main_profile_tab),
    needPhoneNumberPrivacyException: info.need_phone_number_privacy_exception,
    note: nullableJsonValue(info.note),
    outgoingPaidMessageStarCount: String(info.outgoing_paid_message_star_count),
    pendingRating: nullableJsonValue(info.pending_rating),
    pendingRatingDate: tdDate(info.pending_rating_date) ?? null,
    personalChatId: nullableZeroId(info.personal_chat_id),
    personalPhotoId: chatPhotoReferenceId(info.personal_photo ?? null),
    photoId: chatPhotoReferenceId(info.photo ?? null),
    publicPhotoId: chatPhotoReferenceId(info.public_photo ?? null),
    rating: nullableJsonValue(info.rating),
    setChatBackground: info.set_chat_background,
    supportsVideoCalls: info.supports_video_calls,
    usesUnofficialApp: info.uses_unofficial_app
  };
}

function userFullInfoChatPhotoModels(info: UserFullInfo): ChatPhoto[] {
  return userFullInfoTdlibChatPhotos(info).map(chatPhotoFromTdlibChatPhoto);
}

function userFullInfoFileStates(info: UserFullInfo): FileState[] {
  return userFullInfoTdlibChatPhotos(info).flatMap(fileStatesFromTdlibChatPhoto);
}

function userFullInfoTdlibChatPhotos(info: UserFullInfo): TdlibChatPhoto[] {
  return [info.personal_photo ?? null, info.photo ?? null, info.public_photo ?? null].filter(
    (photo): photo is TdlibChatPhoto => photo !== null
  );
}

function chatPhotoReferenceId(photo: TdlibChatPhoto | null): string | null {
  return nullableZeroId(photo?.id);
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = tdId(value);
  return id === undefined || id === '0' ? null : id;
}

function nullableJsonValue(value: unknown): JsonValue {
  return tdJsonValue(value ?? null) ?? null;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
