import type { ModelRef } from '../contracts.js';

export function isModelRouteSafeRef(ref: ModelRef): boolean {
  return ref._model === 'telegram.chat' || ref._model === 'telegram.user'
    ? isTelegramIntegerId(ref.id)
    : true;
}

export function isTelegramIntegerId(value: string): boolean {
  return /^-?\d+$/.test(value);
}
