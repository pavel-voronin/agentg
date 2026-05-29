import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireStakeDiceStateUpdate = TelegramWireUpdateByType<'updateStakeDiceState'>;

export function handleUpdateStakeDiceState(
  update: TelegramWireStakeDiceStateUpdate
): Promise<void> {
  const events = useUpdateEvents();
  events.publishTelegramStakeDiceStateUpdated(update);
  return Promise.resolve();
}
