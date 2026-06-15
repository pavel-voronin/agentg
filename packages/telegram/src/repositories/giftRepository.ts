import type { Database } from '../database/client.js';
import type { FileState } from '../domain/models/fileState.js';
import type { GiftAuction, GiftAuctionState, Gift, UpgradedGift } from '../domain/models/gift.js';
import type { Sticker } from '../domain/models/sticker.js';
import { saveFileStates } from '../storage/fileStorage.js';
import {
  saveGiftAuction,
  saveGiftAuctionState,
  saveGift,
  saveUpgradedGift
} from '../storage/giftStorage.js';
import { saveSticker } from '../storage/stickerStorage.js';

export type GiftRepository = {
  saveAuctionStates(input: {
    auctions: readonly GiftAuction[];
    files: readonly FileState[];
    gifts: readonly Gift[];
    states: readonly GiftAuctionState[];
    stickers: readonly Sticker[];
  }): Promise<void>;
  saveUpgradedGifts(input: {
    files: readonly FileState[];
    gifts: readonly UpgradedGift[];
  }): Promise<void>;
  transaction<T>(operation: (repository: GiftRepository) => Promise<T>): Promise<T>;
};

export function createGiftRepository(database: Database): GiftRepository {
  return {
    saveAuctionStates(input) {
      return database.transaction(async (transaction) => {
        await saveFileStates(transaction, input.files);
        for (const sticker of uniqueBy(input.stickers, (sticker) => String(sticker.fileId))) {
          await saveSticker(transaction, sticker);
        }
        for (const auction of uniqueBy(input.auctions, (auction) => auction.id)) {
          await saveGiftAuction(transaction, auction);
        }
        for (const gift of uniqueBy(input.gifts, (gift) => gift.id)) {
          await saveGift(transaction, gift);
        }
        for (const state of uniqueBy(input.states, (state) => state.auctionId)) {
          await saveGiftAuctionState(transaction, state);
        }
      });
    },
    saveUpgradedGifts(input) {
      return database.transaction(async (transaction) => {
        await saveFileStates(transaction, input.files);
        for (const gift of uniqueBy(input.gifts, (gift) => gift.id)) {
          await saveUpgradedGift(transaction, gift);
        }
      });
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createGiftRepository(transaction)));
    }
  };
}

function uniqueBy<T>(records: readonly T[], keyOf: (record: T) => string): T[] {
  const recordsByKey = new Map<string, T>();
  for (const record of records) {
    recordsByKey.set(keyOf(record), record);
  }
  return [...recordsByKey.values()];
}
