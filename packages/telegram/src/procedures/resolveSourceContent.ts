import { toJsonValue, parseLimit } from '@agentg/framework';
import { z } from 'zod';

import type { Message } from '../domain/models/message.js';
import { nonEmptyStringSchema, positiveIntegerSchema } from '../domain/models/scalars.js';
import { createRepositories } from '../repositories/repositories.js';
import { getMessagesInputSchema, type MessageOwner } from './get-messages/contract.js';
import { runGetMessages } from './get-messages/procedure.js';
import type { ProcedureResources } from './resources.js';

const sourceRefSchema = z
  .object({
    _model: z.string().trim().min(1),
    id: z.string().trim().min(1)
  })
  .strict();

const contentRefSchema = z
  .object({
    _model: z.string().trim().min(1),
    id: z.string().trim().min(1),
    sourceRef: sourceRefSchema.optional()
  })
  .strict();

const recentMessagesSelectorSchema = z
  .object({
    chatId: nonEmptyStringSchema.optional(),
    kind: z.literal('recentMessages'),
    limit: positiveIntegerSchema.optional()
  })
  .strict();

const searchMessagesSelectorSchema = z
  .object({
    chatId: nonEmptyStringSchema.optional(),
    kind: z.literal('searchMessages'),
    limit: positiveIntegerSchema.optional(),
    query: nonEmptyStringSchema
  })
  .strict();

const messagesSelectorSchema = getMessagesInputSchema.extend({
  kind: z.literal('messages')
});

const selectorSchema = z.discriminatedUnion('kind', [
  recentMessagesSelectorSchema,
  searchMessagesSelectorSchema,
  messagesSelectorSchema
]);

const inputSchema = z
  .object({
    sourceSelector: z
      .object({
        domain: z.literal('telegram'),
        selector: selectorSchema
      })
      .strict()
  })
  .strict();

const outputSchema = z.discriminatedUnion('status', [
  z
    .object({
      snapshot: z
        .object({
          contentRefs: z.array(contentRefSchema),
          payload: z.unknown(),
          sourceRefs: z.array(sourceRefSchema)
        })
        .strict(),
      status: z.literal('ready')
    })
    .strict(),
  z
    .object({
      contentRefs: z.array(contentRefSchema).optional(),
      requestId: z.string().trim().min(1),
      sourceRefs: z.array(sourceRefSchema).optional(),
      status: z.literal('pending')
    })
    .strict()
]);

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;
type Selector = z.infer<typeof selectorSchema>;
type SourceRef = z.infer<typeof sourceRefSchema>;

export function resolveSourceContentProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runResolveSourceContent(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

async function runResolveSourceContent(
  input: Input,
  resources: ProcedureResources
): Promise<Output> {
  const selector = input.sourceSelector.selector;
  if (selector.kind === 'messages') {
    const messageRequest = {
      owner: selector.owner,
      selector: selector.selector
    };
    const result = await runGetMessages(messageRequest, resources);
    if (result.status === 'pending') {
      return {
        requestId: result.requestId,
        sourceRefs: [sourceRefForOwner(selector.owner)],
        status: 'pending'
      };
    }
    return readyOutput(result.messages, [sourceRefForOwner(selector.owner)], selector);
  }

  const repositories = createRepositories(resources.database);
  if (selector.kind === 'recentMessages') {
    const messages = await repositories.messages.listRecent({
      chatId: selector.chatId,
      limit: parseLimit(selector.limit, 50, 200)
    });
    return readyOutput(messages, sourceRefsForSelector(selector, messages), selector);
  }

  const messages = await repositories.messages.search({
    chatId: selector.chatId,
    limit: parseLimit(selector.limit, 20, 100),
    query: selector.query
  });
  return readyOutput(messages, sourceRefsForSelector(selector, messages), selector);
}

function readyOutput(
  messages: readonly Message[],
  sourceRefs: readonly SourceRef[],
  selector: Selector
): Output {
  return {
    snapshot: {
      contentRefs: messages.map(contentRefForMessage),
      payload: toJsonValue({
        messages: messages.map(messagePayload),
        selector
      }),
      sourceRefs: [...sourceRefs]
    },
    status: 'ready'
  };
}

function sourceRefsForSelector(selector: Selector, messages: readonly Message[]): SourceRef[] {
  if ('chatId' in selector && selector.chatId !== undefined) {
    return [
      {
        _model: 'telegram.chat',
        id: selector.chatId
      }
    ];
  }

  const refs = new Map<string, SourceRef>();
  for (const message of messages) {
    refs.set(message.chat.id, {
      _model: 'telegram.chat',
      id: message.chat.id
    });
  }
  if (refs.size > 0) {
    return [...refs.values()];
  }
  if (selector.kind === 'searchMessages') {
    return [
      {
        _model: 'telegram.search',
        id: selector.query
      }
    ];
  }
  if (selector.kind === 'messages') {
    return [sourceRefForOwner(selector.owner)];
  }
  return [
    {
      _model: 'telegram.messageCollection',
      id: 'recent'
    }
  ];
}

function sourceRefForOwner(owner: MessageOwner): SourceRef {
  if (owner.kind === 'chat') {
    return {
      _model: 'telegram.chat',
      id: owner.chatId
    };
  }
  return {
    _model: 'telegram.messageOwner',
    id: JSON.stringify(owner)
  };
}

function contentRefForMessage(message: Message) {
  return {
    _model: 'telegram.message',
    id: `${message.chat.id}:${message.id}`,
    sourceRef: {
      _model: 'telegram.chat',
      id: message.chat.id
    }
  };
}

function messagePayload(message: Message) {
  return {
    chatId: message.chat.id,
    contentType: message.contentType,
    messageDate: message.messageDate,
    messageId: message.id,
    senderDisplayName: message.senderDisplayName,
    telegramMessageId: message.telegramMessageId,
    text: message.text
  };
}
