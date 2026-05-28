export type TelegramReactionType = {
  _: string;
  custom_emoji_id?: string;
  emoji?: string;
};

export function reactionTypeKey(type: TelegramReactionType): string {
  if (type._ === 'reactionTypeEmoji' && typeof type.emoji === 'string') {
    return `emoji:${type.emoji}`;
  }
  if (type._ === 'reactionTypeCustomEmoji' && type.custom_emoji_id !== undefined) {
    return `custom_emoji:${type.custom_emoji_id}`;
  }
  if (type._ === 'reactionTypePaid') {
    return 'paid';
  }
  throw new Error(`Unsupported reaction type: ${type._}`);
}
