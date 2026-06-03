import type {
  HistorySyncTarget,
  HistorySyncTemplate,
  HistorySyncTemplateMatch,
  TelegramChatForHistorySync
} from '../model/types.js';
import { sameHistorySyncRange } from '../range/ranges.js';

export function materializeTemplatesForChat(
  templates: HistorySyncTemplate[],
  chat: TelegramChatForHistorySync,
  existingTargets: HistorySyncTarget[] = []
): HistorySyncTarget[] {
  return templates.reduce(
    (targets, template) => materializeTemplateForChat(template, chat, targets),
    existingTargets
  );
}

export function materializeTemplateForChat(
  template: HistorySyncTemplate,
  chat: TelegramChatForHistorySync,
  existingTargets: HistorySyncTarget[] = []
): HistorySyncTarget[] {
  if (!matchesHistorySyncTemplate(template.match, chat)) {
    return existingTargets;
  }

  const templateTargetIndex = existingTargets.findIndex(
    (target) => target.chatId === chat.id && target.templateId === template.id
  );
  if (templateTargetIndex >= 0) {
    return existingTargets.map((target, index) =>
      index === templateTargetIndex ? { ...target, range: template.range } : target
    );
  }

  if (
    existingTargets.some(
      (target) => target.chatId === chat.id && sameHistorySyncRange(target.range, template.range)
    )
  ) {
    return existingTargets;
  }

  return [
    ...existingTargets,
    {
      chatId: chat.id,
      id: createMaterializedTargetId(template.id, chat.id),
      range: template.range,
      templateId: template.id
    }
  ];
}

export function updateLinkedTargetsForTemplate(
  template: HistorySyncTemplate,
  targets: HistorySyncTarget[]
): HistorySyncTarget[] {
  return targets.map((target) =>
    target.templateId === template.id ? { ...target, range: template.range } : target
  );
}

export function editHistorySyncTargetDirectly(
  target: HistorySyncTarget,
  patch: Pick<Partial<HistorySyncTarget>, 'range'>
): HistorySyncTarget {
  return {
    chatId: target.chatId,
    id: target.id,
    range: patch.range ?? target.range
  };
}

export function matchesHistorySyncTemplate(
  match: HistorySyncTemplateMatch,
  chat: TelegramChatForHistorySync
): boolean {
  if (match.all === true) {
    return true;
  }

  if (match.chatType !== undefined) {
    const chatTypes = (Array.isArray(match.chatType) ? match.chatType : [match.chatType]).flatMap(
      normalizeTemplateChatType
    );
    if (!chatTypes.includes(chat.type)) {
      return false;
    }
  }

  if (match.titleIncludes !== undefined && !chat.title.includes(match.titleIncludes)) {
    return false;
  }

  return match.chatType !== undefined || match.titleIncludes !== undefined;
}

function createMaterializedTargetId(templateId: string, chatId: string): string {
  return `${templateId}:${chatId}`;
}

function normalizeTemplateChatType(type: string): string[] {
  if (type === 'chatTypePrivate') {
    return ['private'];
  }
  if (type === 'chatTypeSecret') {
    return ['secret'];
  }
  if (type === 'chatTypeBasicGroup') {
    return ['group'];
  }
  if (type === 'chatTypeChannel') {
    return ['channel'];
  }
  if (type === 'chatTypeSupergroup') {
    return ['group', 'channel'];
  }
  if (type === 'basicGroup' || type === 'supergroup') {
    return ['group'];
  }
  return [type];
}
