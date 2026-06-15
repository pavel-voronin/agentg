import type { JsonValue } from '@agentg/framework';

import type { BusinessConnectionSavedChange, DomainChange } from '../../domain/changes.js';
import type { BusinessConnection } from '../../domain/models/businessConnection.js';
import { tdDate, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type BusinessConnectionUpdate = UpdateByType<'updateBusinessConnection'>;
type TdlibBusinessConnection = BusinessConnectionUpdate['connection'];

export function businessConnectionChanges(update: BusinessConnectionUpdate): DomainChange[] {
  return [
    {
      kind: 'businessConnection.saved',
      connection: businessConnectionRecord(update.connection)
    } satisfies BusinessConnectionSavedChange
  ];
}

function businessConnectionRecord(connection: TdlibBusinessConnection): BusinessConnection {
  return {
    date: requiredTelegramDate(connection.date),
    id: connection.id,
    isEnabled: connection.is_enabled,
    rights: connection.is_enabled ? nullableJsonValue(connection.rights) : null,
    userChatId: String(connection.user_chat_id),
    userId: String(connection.user_id)
  };
}

function requiredTelegramDate(value: number): Date {
  const date = tdDate(value);
  if (date === undefined) {
    throw new Error(`Business connection has invalid date: ${String(value)}`);
  }
  return date;
}

function nullableJsonValue(value: unknown): JsonValue {
  return tdJsonValue(value ?? null) ?? null;
}
