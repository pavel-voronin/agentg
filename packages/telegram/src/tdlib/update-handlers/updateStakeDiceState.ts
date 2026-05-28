import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireStakeDiceStateUpdate = TelegramWireUpdateByType<'updateStakeDiceState'>;

export function handleUpdateStakeDiceState(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireStakeDiceStateUpdate
): Promise<void> {
  events.publishTelegramStakeDiceStateUpdated(update);
  return Promise.resolve();
}
