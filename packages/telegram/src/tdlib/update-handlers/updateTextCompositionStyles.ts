import { replaceTextCompositionStyles } from '../../store/textCompositionStyle.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireTextCompositionStylesUpdate =
  TelegramWireUpdateByType<'updateTextCompositionStyles'>;

export async function handleUpdateTextCompositionStyles(
  update: TelegramWireTextCompositionStylesUpdate
): Promise<void> {
  const database = useDatabase();
  await replaceTextCompositionStyles(database, update.styles);
}
