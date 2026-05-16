import type { JsonValue } from '@agentg/events/json';
import { z } from 'zod';

import {
  tdlibIdSchema,
  tdlibJsonObject,
  tdlibJsonValue,
  tdlibObjectSchema,
  type TdlibObject
} from './common.js';

const tdlibUserInputSchema = z.looseObject({
  _: z.literal('user'),
  first_name: z.optional(z.string()),
  id: tdlibIdSchema,
  is_premium: z.optional(z.boolean()),
  last_name: z.optional(z.string()),
  type: z.optional(tdlibObjectSchema),
  usernames: z.optional(z.unknown())
});

type TdlibUserInput = z.infer<typeof tdlibUserInputSchema>;

export type TdlibUser = {
  firstName: string;
  id: string;
  isBot: boolean;
  isPremium?: boolean | undefined;
  isSelf?: boolean;
  lastName: string;
  type: TdlibObject;
  username?: string;
  usernames?: JsonValue | undefined;
};

export const tdlibUserSchema = tdlibUserInputSchema.transform(buildTdlibUser);

export function tdlibUser(input: unknown, options: { isSelf?: boolean } = {}): TdlibUser {
  const user = tdlibUserSchema.parse(input);
  return options.isSelf === true ? { ...user, isSelf: true } : user;
}

function buildTdlibUser(user: TdlibUserInput): TdlibUser {
  const username = activeUsername(user.usernames);
  const usernames = tdlibJsonValue(user.usernames);

  return {
    firstName: user.first_name ?? '',
    id: String(user.id),
    isBot: user.type?._ === 'userTypeBot',
    isPremium: user.is_premium,
    lastName: user.last_name ?? '',
    type: user.type === undefined ? { _: 'unknown' } : tdlibJsonObject(user.type),
    ...(username === undefined ? {} : { username }),
    ...(usernames === undefined ? {} : { usernames })
  };
}

function activeUsername(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const activeUsernames = (value as { active_usernames?: unknown }).active_usernames;
  return Array.isArray(activeUsernames) && typeof activeUsernames[0] === 'string'
    ? activeUsernames[0]
    : undefined;
}
