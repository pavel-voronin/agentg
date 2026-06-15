import type { MessageReactionUpdatedChange } from '../domain/changes.js';
import type {
  MessageReactionSender,
  MessageReactionSummary,
  MessageReactionType
} from '../domain/models/messageReactionState.js';
import type { MessageRepository } from '../repositories/messageRepository.js';

const RECENT_SENDER_IDS_CAP = 3;

export async function applyMessageReactionUpdate(
  repository: MessageRepository,
  change: MessageReactionUpdatedChange
): Promise<boolean> {
  const oldReactions = uniqueReactionTypes(change.oldReactionTypes);
  const newReactions = uniqueReactionTypes(change.newReactionTypes);
  const removed = [...oldReactions.keys()].filter((key) => !newReactions.has(key));
  const added = [...newReactions.keys()].filter((key) => !oldReactions.has(key));

  if (removed.length === 0 && added.length === 0) {
    return false;
  }

  await repository.transaction(async (transaction) => {
    await transaction.upsert({
      chatId: change.chatId,
      id: change.messageId
    });

    const currentReactions = await transaction.readReactionSummariesForUpdate({
      chatId: change.chatId,
      messageId: change.messageId
    });
    const existingByReactionType = new Map(
      currentReactions.map(
        (summary) => [summary.reactionType.key, summary] satisfies [string, MessageReactionSummary]
      )
    );

    for (const reactionType of removed) {
      const row = existingByReactionType.get(reactionType);
      if (row === undefined) {
        continue;
      }

      const totalCount = row.totalCount - 1;

      if (totalCount <= 0) {
        existingByReactionType.delete(reactionType);
        continue;
      }

      const shouldClearChosen =
        change.actorIsCurrentAccountSender &&
        row.isChosen &&
        row.usedSender?.key === change.actorSender.key;
      const nextRow: MessageReactionSummary = {
        constructorName: row.constructorName,
        isChosen: shouldClearChosen ? false : row.isChosen,
        recentSenders: removeRecentSender(row.recentSenders, change.actorSender.key),
        reactionType: row.reactionType,
        totalCount,
        usedSender: shouldClearChosen ? null : row.usedSender
      };

      existingByReactionType.set(reactionType, nextRow);
    }

    for (const reactionType of added) {
      const row = existingByReactionType.get(reactionType);
      const type = newReactions.get(reactionType);
      if (type === undefined) {
        continue;
      }
      const usedSender = change.actorIsCurrentAccountSender ? change.actorSender : null;

      if (row === undefined) {
        existingByReactionType.set(reactionType, {
          constructorName: null,
          isChosen: change.actorIsCurrentAccountSender,
          reactionType: type,
          recentSenders: [change.actorSender],
          totalCount: 1,
          usedSender
        });
        continue;
      }

      existingByReactionType.set(reactionType, {
        constructorName: row.constructorName,
        isChosen: change.actorIsCurrentAccountSender ? true : row.isChosen,
        reactionType: row.reactionType,
        recentSenders: prependRecentSender(row.recentSenders, change.actorSender),
        totalCount: row.totalCount + 1,
        usedSender: change.actorIsCurrentAccountSender ? change.actorSender : row.usedSender
      });
    }

    await transaction.replaceReactionSummaries({
      chatId: change.chatId,
      messageId: change.messageId,
      reactions: [...existingByReactionType.values()]
    });
  });

  return true;
}

function uniqueReactionTypes(
  reactions: readonly MessageReactionType[]
): Map<string, MessageReactionType> {
  return new Map(reactions.map((reaction) => [reaction.key, reaction]));
}

function removeRecentSender(
  recentSenders: readonly MessageReactionSender[],
  senderKey: string
): MessageReactionSender[] {
  return recentSenders.filter((recentSender) => recentSender.key !== senderKey);
}

function prependRecentSender(
  recentSenders: readonly MessageReactionSender[],
  sender: MessageReactionSender
): MessageReactionSender[] {
  return [sender, ...recentSenders.filter((recentSender) => recentSender.key !== sender.key)].slice(
    0,
    RECENT_SENDER_IDS_CAP
  );
}
