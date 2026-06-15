import type { Database } from '../database/client.js';
import {
  telegramGiftAuctions,
  telegramGiftAuctionStates,
  telegramGifts,
  telegramUpgradedGifts
} from '../database/schema.js';
import type { GiftAuction, GiftAuctionState, Gift, UpgradedGift } from '../domain/models/gift.js';

export async function saveGiftAuction(database: Database, auction: GiftAuction): Promise<void> {
  await database.insert(telegramGiftAuctions).values(auction).onConflictDoUpdate({
    set: auction,
    target: telegramGiftAuctions.id
  });
}

export async function saveGift(database: Database, gift: Gift): Promise<void> {
  await database.insert(telegramGifts).values(gift).onConflictDoUpdate({
    set: gift,
    target: telegramGifts.id
  });
}

export async function saveGiftAuctionState(
  database: Database,
  state: GiftAuctionState
): Promise<void> {
  await database.insert(telegramGiftAuctionStates).values(state).onConflictDoUpdate({
    set: state,
    target: telegramGiftAuctionStates.auctionId
  });
}

export async function saveUpgradedGift(database: Database, gift: UpgradedGift): Promise<void> {
  await database.insert(telegramUpgradedGifts).values(gift).onConflictDoUpdate({
    set: gift,
    target: telegramUpgradedGifts.id
  });
}
