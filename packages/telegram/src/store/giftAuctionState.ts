import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import {
  telegramFiles,
  telegramGiftAuctionStates,
  telegramGiftAuctions,
  telegramGifts,
  telegramStickers
} from '../database/schema.js';
import { tdJsonObject, tdJsonValue, type UpdateByType } from '../tdlib/shape.js';
import type { file as File } from 'tdlib-types';

type GiftAuctionState = UpdateByType<'updateActiveGiftAuctions'>['states'][number];
type Gift = GiftAuctionState['gift'];
type GiftAuction = NonNullable<Gift['auction_info']>;
type Sticker = Gift['sticker'];

export async function storeGiftAuctionStates(
  database: Database,
  states: GiftAuctionState[]
): Promise<void> {
  for (const state of states) {
    await storeGiftAuctionState(database, state);
  }
}

async function storeGiftAuctionState(
  database: Database,
  giftAuctionState: GiftAuctionState
): Promise<void> {
  const gift = giftAuctionState.gift;
  const auctionInfo = requiredGiftAuctionInfo(gift);

  await storeGift(database, gift);

  const row: typeof telegramGiftAuctionStates.$inferInsert = {
    auctionId: auctionInfo.id,
    giftId: gift.id,
    state: tdJsonObject(giftAuctionState.state)
  };

  await database.insert(telegramGiftAuctionStates).values(row).onConflictDoUpdate({
    set: row,
    target: telegramGiftAuctionStates.auctionId
  });
}

async function storeGift(database: Database, gift: Gift): Promise<void> {
  const auctionInfo = gift.auction_info ?? null;
  if (auctionInfo !== null) {
    await storeGiftAuction(database, auctionInfo);
  }
  await storeSticker(database, gift.sticker);

  const row: typeof telegramGifts.$inferInsert = {
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

  await database.insert(telegramGifts).values(row).onConflictDoUpdate({
    set: row,
    target: telegramGifts.id
  });
}

async function storeGiftAuction(database: Database, auction: GiftAuction): Promise<void> {
  const row: typeof telegramGiftAuctions.$inferInsert = {
    giftsPerRound: auction.gifts_per_round,
    id: auction.id,
    startDate: unixDate(auction.start_date)
  };

  await database.insert(telegramGiftAuctions).values(row).onConflictDoUpdate({
    set: row,
    target: telegramGiftAuctions.id
  });
}

async function storeSticker(database: Database, sticker: Sticker): Promise<void> {
  await storeFile(database, sticker.sticker);

  const thumbnail = sticker.thumbnail ?? null;
  if (thumbnail !== null) {
    await storeFile(database, thumbnail.file);
  }

  const row: typeof telegramStickers.$inferInsert = {
    emoji: sticker.emoji,
    fileId: sticker.sticker.id,
    format: tdJsonObject(sticker.format),
    fullType: tdJsonObject(sticker.full_type),
    height: sticker.height,
    id: nullableZeroId(sticker.id),
    setId: nullableZeroId(sticker.set_id),
    thumbnail: requiredJsonValue(thumbnail),
    width: sticker.width
  };

  await database.insert(telegramStickers).values(row).onConflictDoUpdate({
    set: row,
    target: telegramStickers.fileId
  });
}

async function storeFile(database: Database, file: File): Promise<void> {
  const row: typeof telegramFiles.$inferInsert = {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: tdJsonObject(file.local),
    remote: tdJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };

  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

function requiredGiftAuctionInfo(gift: Gift): GiftAuction {
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

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
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
