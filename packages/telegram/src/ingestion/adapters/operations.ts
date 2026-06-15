import type { IngestionOperationPort } from '../index.js';
import type { Tdlib } from '../../tdlib/index.js';

export function createIngestionOperations(tdlib: Tdlib): IngestionOperationPort {
  return {
    getChat(input, invokeOptions) {
      return tdlib.getChat(input, invokeOptions);
    },
    getChats(input, invokeOptions) {
      return tdlib.getChats(input, invokeOptions);
    },
    getMe(invokeOptions) {
      return tdlib.getMe(invokeOptions);
    },
    loadChats(input, invokeOptions) {
      return tdlib.loadChats(input, invokeOptions);
    },
    onUpdate(handler) {
      return tdlib.onUpdate(handler);
    }
  };
}
