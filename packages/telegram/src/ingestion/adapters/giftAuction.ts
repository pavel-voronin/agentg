import type { JsonValue } from '@agentg/framework';

import type { DomainChange, GiftAuctionStatesSavedChange } from '../../domain/changes.js';
import type { FileState } from '../../domain/models/fileState.js';
import type { GiftAuction, GiftAuctionState, Gift } from '../../domain/models/gift.js';
import { tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import { stickerFileStatesFromTdlibSticker, stickerRecordFromTdlibSticker } from './sticker.js';

type ActiveGiftAuctionsUpdate = UpdateByType<'updateActiveGiftAuctions'>;
type GiftAuctionStateUpdate = UpdateByType<'updateGiftAuctionState'>;
type TdlibGiftAuctionState = ActiveGiftAuctionsUpdate['states'][number];
type TdlibGift = TdlibGiftAuctionState['gift'];
type TdlibGiftAuction = NonNullable<TdlibGift['auction_info']>;

export function activeGiftAuctionsChanges(update: ActiveGiftAuctionsUpdate): DomainChange[] {
  return giftAuctionStatesChanges(update.states);
}

export function giftAuctionStateChanges(update: GiftAuctionStateUpdate): DomainChange[] {
  return giftAuctionStatesChanges([update.state]);
}

function giftAuctionStatesChanges(states: readonly TdlibGiftAuctionState[]): DomainChange[] {
  return [
    {
      kind: 'giftAuctionStates.saved',
      input: {
        auctions: states.map((state) => giftAuctionRecord(requiredGiftAuctionInfo(state.gift))),
        files: uniqueFileStates(states.flatMap((state) => giftFileStates(state.gift))),
        gifts: states.map((state) => giftRecord(state.gift)),
        states: states.map(giftAuctionStateRecord),
        stickers: states.map((state) => stickerRecordFromTdlibSticker(state.gift.sticker))
      }
    } satisfies GiftAuctionStatesSavedChange
  ];
}

function giftAuctionStateRecord(state: TdlibGiftAuctionState): GiftAuctionState {
  const auctionInfo = requiredGiftAuctionInfo(state.gift);
  return {
    auctionId: auctionInfo.id,
    giftId: state.gift.id,
    state: tdJsonObject(state.state)
  };
}

function giftRecord(gift: TdlibGift): Gift {
  const auctionInfo = gift.auction_info ?? null;
  return {
    auctionId: auctionInfo?.id ?? null,
    background: tdJsonObject(gift.background),
    defaultSellStarCount: String(gift.default_sell_star_count),
    firstSendDate: unixDate(gift.first_send_date),
    hasColors: gift.has_colors,
    id: gift.id,
    isForBirthday: gift.is_for_birthday,
    isPremium: gift.is_premium,
    lastSendDate: unixDate(gift.last_send_date),
    nextSendDate: unixDate(gift.next_send_date),
    overallLimits: requiredJsonValue(gift.overall_limits ?? null),
    publisherChatId: nullableZeroId(gift.publisher_chat_id),
    starCount: String(gift.star_count),
    stickerFileId: gift.sticker.sticker.id,
    upgradeStarCount: String(gift.upgrade_star_count),
    upgradeVariantCount: gift.upgrade_variant_count,
    userLimits: requiredJsonValue(gift.user_limits ?? null)
  };
}

function giftAuctionRecord(auction: TdlibGiftAuction): GiftAuction {
  return {
    giftsPerRound: auction.gifts_per_round,
    id: auction.id,
    startDate: unixDate(auction.start_date)
  };
}

function giftFileStates(gift: TdlibGift): FileState[] {
  return stickerFileStatesFromTdlibSticker(gift.sticker);
}

function requiredGiftAuctionInfo(gift: TdlibGift): TdlibGiftAuction {
  const auctionInfo = gift.auction_info ?? null;
  if (auctionInfo === null) {
    throw new Error('Expected GiftAuctionState gift auction_info');
  }
  return auctionInfo;
}

function nullableZeroId(value: number | string): string | null {
  const id = String(value);
  return id === '0' ? null : id;
}

function unixDate(value: number): Date {
  return new Date(value * 1000);
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}

function uniqueFileStates(files: readonly FileState[]): FileState[] {
  const filesById = new Map<number, FileState>();
  for (const file of files) {
    filesById.set(file.id, file);
  }
  return [...filesById.values()];
}
