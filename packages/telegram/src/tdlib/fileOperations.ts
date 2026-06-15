import type { FileOperationPort } from '../files/runtime.js';
import { fileSnapshotFromTdlibFile } from './fileSnapshot.js';
import type { Tdlib } from './index.js';
import { tdFileOrUndefined, tdJsonObject } from './shape.js';

export function createFileOperations(tdlib: Tdlib): FileOperationPort {
  return {
    async addFileToDownloads(input, invokeOptions) {
      return fileSnapshotFromTdlibFile(await tdlib.addFileToDownloads(input, invokeOptions));
    },
    async deleteFile(input, invokeOptions) {
      await tdlib.deleteFile(input, invokeOptions);
    },
    async downloadFile(input, invokeOptions) {
      return fileSnapshotFromTdlibFile(await tdlib.downloadFile(input, invokeOptions));
    },
    async finishFileGeneration(input, invokeOptions) {
      await tdlib.finishFileGeneration(input, invokeOptions);
    },
    async getFile(input, invokeOptions) {
      const file = tdFileOrUndefined(await tdlib.getFile(input, invokeOptions));
      return file === undefined ? undefined : fileSnapshotFromTdlibFile(file);
    },
    async getMessageContent(input, invokeOptions) {
      const message = await tdlib.getMessage(input, invokeOptions);
      return tdJsonObject(message.content);
    },
    getQueueStats() {
      return tdlib.getQueueStats();
    },
    async removeFileFromDownloads(input, invokeOptions) {
      await tdlib.removeFileFromDownloads(input, invokeOptions);
    },
    async setFileGenerationProgress(input, invokeOptions) {
      await tdlib.setFileGenerationProgress(input, invokeOptions);
    }
  };
}
