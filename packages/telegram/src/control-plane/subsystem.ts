import {
  createProcedureRouter,
  type ControlPlaneSubsystem,
  type DomainControlPlaneConfig,
  type DomainProcedureRouter,
  type PrefixedProcedureMap
} from '@agentg/framework/domain';

import { chatDirectory } from './backend/procedures/chatDirectory.js';
import { fileQueueStats } from './backend/procedures/fileQueueStats.js';
import { createTelegramControlPlane } from './manifest.js';
import { message } from './backend/procedures/message.js';
import { messagesPage } from './backend/procedures/messagesPage.js';
import { requestFile } from './backend/procedures/requestFile.js';
import type { TelegramRpcRuntime } from '../main.js';

export type TelegramControlPlane = ReturnType<typeof createTelegramControlPlane>;

const telegramControlPlaneProcedures = {
  chatDirectory,
  fileQueueStats,
  message,
  messagesPage,
  requestFile
};

export type TelegramControlPlaneProcedures = PrefixedProcedureMap<
  'cp',
  typeof telegramControlPlaneProcedures
>;

export class TelegramControlPlaneSubsystem implements ControlPlaneSubsystem<
  TelegramControlPlane,
  TelegramRpcRuntime
> {
  createControlPlane(config: DomainControlPlaneConfig): TelegramControlPlane {
    return createTelegramControlPlane(config.assetVersion, config.assetVersions);
  }

  createProcedureRouter(): DomainProcedureRouter<
    TelegramRpcRuntime,
    TelegramControlPlaneProcedures
  > {
    return createProcedureRouter('cp', telegramControlPlaneProcedures);
  }
}
