import type { AppDatabase } from '@agentg/database/client';
import type { EventBus } from '@agentg/shared/events/bus';
import { createTelegramIntegrationEvents } from '@agentg/shared/events/telegram-events';

import {
  asTdObject,
  normalizeChat,
  normalizeHistoricalMessage,
  normalizeTelegramUpdate,
  type TdObject
} from './normalize.js';
import {
  getBackfillChatWindowState,
  getBackfillSchedulerState,
  getCatchupState,
  setBackfillChatWindowState,
  setBackfillSchedulerState,
  setCatchupState,
  type BackfillChatWindowState,
  type BackfillPhase,
  type BackfillSchedulerState,
  type CatchupState
} from './sync-state.js';
import { persistTelegramUpdate, upsertChat } from './store.js';
import {
  createTelegramClient,
  hasTelegramCredentials,
  type TelegramClientConfig
} from './tdlib.js';

export type BackfillOptions = {
  chatLoadBatchSize: number;
  catchupBootstrapLookbackDays: number;
  catchupOverlapDays: number;
  catchupWindowDays: number;
  messageLimit: number;
  requestDelayMs: number;
  windowDays: number;
};

export type TelegramIngestionOptions = {
  backfill: BackfillOptions;
  database: AppDatabase;
  eventBus: EventBus;
  telegram: TelegramClientConfig;
};

type PersistenceStats = {
  chats: number;
  messages: number;
  rawEvents: number;
  users: number;
};

type TelegramClient = Awaited<ReturnType<typeof createTelegramClient>>;

type BackfillQueue = Exclude<BackfillPhase, 'complete'>;
type ChatListKind = 'main' | 'archive';

type BackfillChat = {
  category: BackfillQueue;
  id: number;
  title: string;
  type: string;
};

type BackfillWindow = {
  end: Date;
  start: Date;
};

type WindowBackfillResult = {
  fetchedMessages: number;
  reachedBeginning: boolean;
  storedMessages: number;
  windowComplete: boolean;
};

export async function runTelegramIngestion(options: TelegramIngestionOptions): Promise<void> {
  if (!hasTelegramCredentials(options.telegram)) {
    throw new Error('Telegram ingestion requires TELEGRAM_API_ID and TELEGRAM_API_HASH');
  }

  const client = await createTelegramClient(options.telegram);
  const persistenceStats = createPersistenceStats();
  let shuttingDown = false;

  client.on('error', (error: unknown) => {
    console.error(JSON.stringify({ event: 'telegram.error', error: String(error) }));
  });
  client.on('update', (update: unknown) => {
    logSafeTelegramUpdate(update);
    void persistLiveUpdate(options.database, update, persistenceStats, options.eventBus);
  });

  await client.login();
  await logAuthenticatedClient(client);
  await syncInitialChats(options.database, client);

  const backfillTask = runStartupSync(options.database, client, options.backfill).catch(
    (error: unknown) => {
      if (!shuttingDown) {
        console.error(
          JSON.stringify({
            event: 'telegram.startup_sync_failed',
            error: error instanceof Error ? error.message : String(error)
          })
        );
      }
    }
  );

  console.log(JSON.stringify({ event: 'telegram.ingestion_ready' }));
  await waitForShutdown(async () => {
    shuttingDown = true;
    await client.close();
    await options.eventBus.close();
    await backfillTask;
  });
}

async function runStartupSync(
  database: AppDatabase,
  client: TelegramClient,
  options: BackfillOptions
): Promise<void> {
  const safeOptions = normalizeBackfillOptions(options);

  await runCatchup(database, client, safeOptions);
  await runBackfill(database, client, safeOptions);
}

async function logAuthenticatedClient(client: TelegramClient): Promise<void> {
  const me = asTdObject(await client.invoke({ _: 'getMe' }));
  const chats = asTdObject(
    await client.invoke({
      _: 'getChats',
      chat_list: { _: 'chatListMain' },
      limit: 20
    })
  );

  console.log(
    JSON.stringify({
      event: 'telegram.authenticated',
      me: summarizeCurrentUser(me),
      chatCount: Array.isArray(chats?.chat_ids) ? chats.chat_ids.length : 0
    })
  );
}

async function runBackfill(
  database: AppDatabase,
  client: TelegramClient,
  options: BackfillOptions
): Promise<void> {
  const safeOptions = normalizeBackfillOptions(options);
  const scheduler = await getOrCreateSchedulerState(database);

  console.log(
    JSON.stringify({
      event: 'telegram.backfill_started',
      phase: scheduler.phase
    })
  );

  while (scheduler.phase !== 'complete') {
    const chats = await discoverBackfillChats(database, client, safeOptions.chatLoadBatchSize);
    const phaseChats = chats.filter((chat) => chat.category === scheduler.phase);

    if (phaseChats.length === 0) {
      advanceSchedulerPastPhase(scheduler);
      await setBackfillSchedulerState(database, scheduler);
      continue;
    }

    const window = getSchedulerWindow(scheduler, safeOptions.windowDays);
    const stats = await runBackfillWindow(database, client, scheduler.phase, phaseChats, window, {
      messageLimit: safeOptions.messageLimit,
      requestDelayMs: safeOptions.requestDelayMs
    });

    console.log(
      JSON.stringify({
        event: 'telegram.backfill_window_complete',
        phase: scheduler.phase,
        windowStart: window.start.toISOString(),
        windowEnd: window.end.toISOString(),
        ...stats
      })
    );

    if (stats.remainingChats === 0) {
      advanceSchedulerPastPhase(scheduler);
    } else {
      advanceSchedulerWindow(scheduler, window.start);
    }

    await setBackfillSchedulerState(database, scheduler);
  }

  console.log(JSON.stringify({ event: 'telegram.backfill_complete' }));
}

async function runCatchup(
  database: AppDatabase,
  client: TelegramClient,
  options: BackfillOptions
): Promise<void> {
  const catchupStartedAt = new Date();
  const state = await getCatchupState(database);
  const catchupStart = getCatchupStart(catchupStartedAt, state, options);

  if (catchupStart >= catchupStartedAt) {
    await setCatchupState(database, {
      lastCompletedAtIso: catchupStartedAt.toISOString(),
      version: 1
    });
    console.log(JSON.stringify({ event: 'telegram.catchup_skipped' }));
    return;
  }

  const chats = await discoverBackfillChats(database, client, options.chatLoadBatchSize);
  const totals = {
    chats: 0,
    fetchedMessages: 0,
    storedMessages: 0,
    windows: 0
  };

  console.log(
    JSON.stringify({
      event: 'telegram.catchup_started',
      freshInstall: state === undefined,
      from: catchupStart.toISOString(),
      to: catchupStartedAt.toISOString(),
      totalChats: chats.length
    })
  );

  for (const window of getCatchupWindows(
    catchupStart,
    catchupStartedAt,
    options.catchupWindowDays
  )) {
    const stats = await runCatchupWindow(database, client, chats, window, {
      messageLimit: options.messageLimit,
      requestDelayMs: options.requestDelayMs
    });

    totals.chats += stats.chats;
    totals.fetchedMessages += stats.fetchedMessages;
    totals.storedMessages += stats.storedMessages;
    totals.windows += 1;

    console.log(
      JSON.stringify({
        event: 'telegram.catchup_window_complete',
        windowStart: window.start.toISOString(),
        windowEnd: window.end.toISOString(),
        ...stats
      })
    );
  }

  await setCatchupState(database, {
    lastCompletedAtIso: catchupStartedAt.toISOString(),
    version: 1
  });

  console.log(
    JSON.stringify({
      event: 'telegram.catchup_complete',
      freshInstall: state === undefined,
      from: catchupStart.toISOString(),
      to: catchupStartedAt.toISOString(),
      ...totals
    })
  );
}

async function persistLiveUpdate(
  database: AppDatabase,
  update: unknown,
  stats: PersistenceStats,
  eventBus: EventBus
): Promise<void> {
  const normalized = normalizeTelegramUpdate(update);
  if (normalized?.event === undefined) {
    return;
  }

  const result = await persistTelegramUpdate(database, normalized);
  if (result.chat) {
    stats.chats += 1;
  }
  if (result.event) {
    stats.rawEvents += 1;
  }
  if (result.message) {
    stats.messages += 1;
  }
  if (result.user) {
    stats.users += 1;
  }

  for (const event of createTelegramIntegrationEvents(normalized, result)) {
    eventBus.publish(event);
  }

  if (stats.rawEvents > 0 && stats.rawEvents % 500 === 0) {
    console.log(
      JSON.stringify({
        event: 'telegram.persistence_summary',
        ...stats
      })
    );
  }
}

function createPersistenceStats(): PersistenceStats {
  return {
    chats: 0,
    messages: 0,
    rawEvents: 0,
    users: 0
  };
}

async function syncInitialChats(
  database: AppDatabase,
  client: TelegramClient,
  limit = 100
): Promise<void> {
  const chatIds = await getMainChatIds(client, limit);
  let storedChatCount = 0;

  for (const chatId of chatIds) {
    const chat = normalizeChat(asTdObject(await client.invoke({ _: 'getChat', chat_id: chatId })));
    if (chat !== undefined && (await upsertChat(database, chat))) {
      storedChatCount += 1;
    }
  }

  console.log(
    JSON.stringify({
      event: 'telegram.initial_chats_synced',
      storedChatCount
    })
  );
}

async function getMainChatIds(client: TelegramClient, limit: number): Promise<number[]> {
  return getChatIds(client, 'main', limit);
}

async function getChatIds(
  client: TelegramClient,
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  let chats: TdObject | undefined;
  try {
    chats = asTdObject(
      await invokeTdlib(client, {
        _: 'getChats',
        chat_list: toTdChatList(chatList),
        limit
      })
    );
  } catch (error) {
    if (chatList === 'archive' && isTdlibNotFound(error)) {
      return [];
    }

    throw error;
  }

  return Array.isArray(chats?.chat_ids) ? chats.chat_ids.filter(isTelegramId) : [];
}

function normalizeBackfillOptions(options: BackfillOptions): BackfillOptions {
  return {
    chatLoadBatchSize: Math.max(1, options.chatLoadBatchSize),
    catchupBootstrapLookbackDays: Math.max(1, options.catchupBootstrapLookbackDays),
    catchupOverlapDays: Math.max(0, options.catchupOverlapDays),
    catchupWindowDays: Math.max(1, options.catchupWindowDays),
    messageLimit: Math.min(100, Math.max(1, options.messageLimit)),
    requestDelayMs: Math.max(0, options.requestDelayMs),
    windowDays: Math.max(1, options.windowDays)
  };
}

async function getOrCreateSchedulerState(database: AppDatabase): Promise<BackfillSchedulerState> {
  const existing = await getBackfillSchedulerState(database);
  if (existing !== undefined) {
    return existing;
  }

  const nowIso = new Date().toISOString();
  const state: BackfillSchedulerState = {
    groupChannelWindowEndIso: nowIso,
    phase: 'private',
    privateWindowEndIso: nowIso,
    version: 2
  };

  await setBackfillSchedulerState(database, state);
  return state;
}

async function discoverBackfillChats(
  database: AppDatabase,
  client: TelegramClient,
  loadBatchSize: number
): Promise<BackfillChat[]> {
  await loadAllChats(client, loadBatchSize);

  const chatIds = dedupeTelegramIds([
    ...(await getChatIds(client, 'main', 100000)),
    ...(await getChatIds(client, 'archive', 100000))
  ]);
  const chats: BackfillChat[] = [];

  for (const chatId of chatIds) {
    const chat = await getChatOrUndefined(client, chatId);
    if (chat === undefined) {
      continue;
    }

    const normalized = normalizeChat(chat);
    if (normalized !== undefined) {
      await upsertChat(database, normalized);
    }

    const category = classifyBackfillChat(chat);
    if (category !== undefined) {
      chats.push({
        category,
        id: chatId,
        title: typeof chat.title === 'string' ? chat.title : '',
        type: asTdObject(chat.type)?._ ?? 'unknown'
      });
    }
  }

  return chats;
}

async function getChatOrUndefined(
  client: TelegramClient,
  chatId: number
): Promise<TdObject | undefined> {
  try {
    return asTdObject(await invokeTdlib(client, { _: 'getChat', chat_id: chatId }));
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

async function loadAllChats(client: TelegramClient, batchSize: number): Promise<void> {
  await loadAllChatsFromList(client, 'main', batchSize);
  await loadAllChatsFromList(client, 'archive', batchSize);
}

async function loadAllChatsFromList(
  client: TelegramClient,
  chatList: ChatListKind,
  batchSize: number
): Promise<void> {
  for (;;) {
    try {
      await invokeTdlib(client, {
        _: 'loadChats',
        chat_list: toTdChatList(chatList),
        limit: batchSize
      });
    } catch (error) {
      if (isTdlibNotFound(error)) {
        return;
      }

      throw error;
    }
  }
}

function toTdChatList(chatList: ChatListKind): TdObject {
  return chatList === 'main' ? { _: 'chatListMain' } : { _: 'chatListArchive' };
}

function dedupeTelegramIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function classifyBackfillChat(chat: TdObject | undefined): BackfillQueue | undefined {
  const type = asTdObject(chat?.type);

  if (type?._ === 'chatTypePrivate' || type?._ === 'chatTypeSecret') {
    return 'private';
  }

  if (type?._ === 'chatTypeBasicGroup') {
    return 'group_channel';
  }

  if (type?._ === 'chatTypeSupergroup') {
    return 'group_channel';
  }

  return undefined;
}

function getCatchupStart(
  catchupStartedAt: Date,
  state: CatchupState | undefined,
  options: Pick<BackfillOptions, 'catchupBootstrapLookbackDays' | 'catchupOverlapDays'>
): Date {
  if (state === undefined) {
    return subtractDays(catchupStartedAt, options.catchupBootstrapLookbackDays);
  }

  return subtractDays(new Date(state.lastCompletedAtIso), options.catchupOverlapDays);
}

function getCatchupWindows(start: Date, end: Date, windowDays: number): BackfillWindow[] {
  const windows: BackfillWindow[] = [];
  let windowEnd = end;

  while (windowEnd > start) {
    const windowStart = maxDate(start, subtractDays(windowEnd, windowDays));
    windows.push({
      end: windowEnd,
      start: windowStart
    });
    windowEnd = windowStart;
  }

  return windows;
}

async function runCatchupWindow(
  database: AppDatabase,
  client: TelegramClient,
  chats: BackfillChat[],
  window: BackfillWindow,
  options: Pick<BackfillOptions, 'messageLimit' | 'requestDelayMs'>
): Promise<{
  chats: number;
  fetchedMessages: number;
  storedMessages: number;
}> {
  const stats = {
    chats: 0,
    fetchedMessages: 0,
    storedMessages: 0
  };

  for (const chat of chats) {
    const state = createEphemeralWindowState('private', window);
    const initializedState = await ensureWindowCursor(database, client, chat.id, state, window, {
      persistState: false
    });
    const result =
      initializedState.reachedBeginning || initializedState.windowComplete
        ? {
            fetchedMessages: 0,
            reachedBeginning: initializedState.reachedBeginning,
            storedMessages: 0,
            windowComplete: initializedState.windowComplete
          }
        : await fetchWindowMessages(database, client, chat.id, initializedState, window, options, {
            persistState: false
          });

    stats.chats += 1;
    stats.fetchedMessages += result.fetchedMessages;
    stats.storedMessages += result.storedMessages;
  }

  return stats;
}

function createEphemeralWindowState(
  phase: BackfillQueue,
  window: BackfillWindow
): BackfillChatWindowState {
  return {
    fetchedCount: 0,
    phase,
    reachedBeginning: false,
    version: 2,
    windowComplete: false,
    windowEndIso: window.end.toISOString(),
    windowStartIso: window.start.toISOString()
  };
}

async function runBackfillWindow(
  database: AppDatabase,
  client: TelegramClient,
  phase: BackfillQueue,
  chats: BackfillChat[],
  window: BackfillWindow,
  options: Pick<BackfillOptions, 'messageLimit' | 'requestDelayMs'>
): Promise<{
  chats: number;
  fetchedMessages: number;
  remainingChats: number;
  storedMessages: number;
}> {
  const stats = {
    chats: 0,
    fetchedMessages: 0,
    remainingChats: 0,
    storedMessages: 0
  };

  for (const chat of chats) {
    const result = await backfillChatWindow(database, client, phase, chat, window, options);
    stats.chats += 1;
    stats.fetchedMessages += result.fetchedMessages;
    stats.storedMessages += result.storedMessages;

    if (!result.reachedBeginning) {
      stats.remainingChats += 1;
    }
  }

  return stats;
}

async function backfillChatWindow(
  database: AppDatabase,
  client: TelegramClient,
  phase: BackfillQueue,
  chat: BackfillChat,
  window: BackfillWindow,
  options: Pick<BackfillOptions, 'messageLimit' | 'requestDelayMs'>
): Promise<WindowBackfillResult> {
  const state = await getChatWindowState(database, phase, chat.id, window);

  if (state.reachedBeginning || state.windowComplete) {
    return {
      fetchedMessages: 0,
      reachedBeginning: state.reachedBeginning,
      storedMessages: 0,
      windowComplete: state.windowComplete
    };
  }

  const initializedState = await ensureWindowCursor(database, client, chat.id, state, window);
  if (initializedState.reachedBeginning) {
    return {
      fetchedMessages: 0,
      reachedBeginning: true,
      storedMessages: 0,
      windowComplete: true
    };
  }

  const result = await fetchWindowMessages(
    database,
    client,
    chat.id,
    initializedState,
    window,
    options
  );

  console.log(
    JSON.stringify({
      event: 'telegram.backfill_chat_window',
      chatId: chat.id,
      chatTitle: chat.title,
      fetchedMessages: result.fetchedMessages,
      phase,
      reachedBeginning: result.reachedBeginning,
      storedMessages: result.storedMessages,
      type: chat.type,
      windowComplete: result.windowComplete,
      windowEnd: window.end.toISOString(),
      windowStart: window.start.toISOString()
    })
  );

  return result;
}

async function getChatWindowState(
  database: AppDatabase,
  phase: BackfillQueue,
  chatId: number,
  window: BackfillWindow
): Promise<BackfillChatWindowState> {
  const existing = await getBackfillChatWindowState(database, phase, chatId);
  if (
    existing?.windowStartIso === window.start.toISOString() &&
    existing.windowEndIso === window.end.toISOString()
  ) {
    return existing;
  }

  return {
    fetchedCount: existing?.fetchedCount ?? 0,
    phase,
    reachedBeginning: existing?.reachedBeginning === true,
    version: 2,
    windowComplete: false,
    windowEndIso: window.end.toISOString(),
    windowStartIso: window.start.toISOString()
  };
}

async function ensureWindowCursor(
  database: AppDatabase,
  client: TelegramClient,
  chatId: number,
  state: BackfillChatWindowState,
  window: BackfillWindow,
  options: { persistState: boolean } = { persistState: true }
): Promise<BackfillChatWindowState> {
  if (state.cursorMessageId !== undefined) {
    return state;
  }

  const anchor = await getLastMessageNoLaterThan(client, chatId, window.end);
  if (anchor === undefined) {
    const nextState = {
      ...state,
      reachedBeginning: true,
      windowComplete: true
    };
    if (options.persistState) {
      await setBackfillChatWindowState(database, chatId, nextState);
    }
    return nextState;
  }

  const anchorDate = tdMessageDate(anchor);
  const anchorMessageId = tdMessageId(anchor);
  if (anchorMessageId === undefined) {
    const nextState = {
      ...state,
      reachedBeginning: true,
      windowComplete: true
    };
    if (options.persistState) {
      await setBackfillChatWindowState(database, chatId, nextState);
    }
    return nextState;
  }

  if (anchorDate !== undefined && anchorDate < window.start) {
    const nextState = {
      ...state,
      cursorMessageId: anchorMessageId,
      windowComplete: true
    };
    if (options.persistState) {
      await setBackfillChatWindowState(database, chatId, nextState);
    }
    return nextState;
  }

  const nextState = {
    ...state,
    cursorMessageId: anchorMessageId
  };
  if (options.persistState) {
    await setBackfillChatWindowState(database, chatId, nextState);
  }
  return nextState;
}

async function fetchWindowMessages(
  database: AppDatabase,
  client: TelegramClient,
  chatId: number,
  state: BackfillChatWindowState,
  window: BackfillWindow,
  options: Pick<BackfillOptions, 'messageLimit' | 'requestDelayMs'>,
  stateOptions: { persistState: boolean } = { persistState: true }
): Promise<WindowBackfillResult> {
  let cursorMessageId = state.cursorMessageId;
  let fetchedMessages = 0;
  let storedMessages = 0;
  let reachedBeginning = state.reachedBeginning;
  let windowComplete = state.windowComplete;

  while (cursorMessageId !== undefined && !reachedBeginning && !windowComplete) {
    await delay(options.requestDelayMs);

    const history = asTdObject(
      await invokeTdlib(client, {
        _: 'getChatHistory',
        chat_id: chatId,
        from_message_id: cursorMessageId,
        limit: options.messageLimit,
        offset: 0,
        only_local: false
      })
    );

    const messages = Array.isArray(history?.messages) ? history.messages.map(asTdObject) : [];
    const concreteMessages = messages.filter(isTdObject);

    if (concreteMessages.length === 0) {
      reachedBeginning = true;
      windowComplete = true;
      break;
    }

    fetchedMessages += concreteMessages.length;

    for (const message of concreteMessages) {
      const messageDate = tdMessageDate(message);
      if (messageDate === undefined || messageDate < window.start || messageDate >= window.end) {
        continue;
      }

      const normalized = normalizeHistoricalMessage(message);
      if (normalized !== undefined) {
        const result = await persistTelegramUpdate(database, normalized);
        if (result.message) {
          storedMessages += 1;
        }
      }
    }

    if (concreteMessages.some((message) => isBeforeWindow(message, window))) {
      windowComplete = true;
    }

    const nextCursor = oldestMessageIdOlderThan(concreteMessages, cursorMessageId);
    if (nextCursor === undefined) {
      reachedBeginning = true;
      windowComplete = true;
      cursorMessageId = undefined;
    } else {
      cursorMessageId = nextCursor;
    }

    if (stateOptions.persistState) {
      await setBackfillChatWindowState(database, chatId, {
        ...state,
        ...(cursorMessageId === undefined ? {} : { cursorMessageId }),
        fetchedCount: state.fetchedCount + fetchedMessages,
        reachedBeginning,
        windowComplete
      });
    }
  }

  return {
    fetchedMessages,
    reachedBeginning,
    storedMessages,
    windowComplete
  };
}

async function getLastMessageNoLaterThan(
  client: TelegramClient,
  chatId: number,
  end: Date
): Promise<TdObject | undefined> {
  try {
    return asTdObject(
      await invokeTdlib(client, {
        _: 'getChatMessageByDate',
        chat_id: chatId,
        date: Math.floor((end.getTime() - 1) / 1000)
      })
    );
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

function getSchedulerWindow(scheduler: BackfillSchedulerState, windowDays: number): BackfillWindow {
  const end =
    scheduler.phase === 'private'
      ? new Date(scheduler.privateWindowEndIso)
      : new Date(scheduler.groupChannelWindowEndIso);
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);

  return { end, start };
}

function advanceSchedulerWindow(scheduler: BackfillSchedulerState, nextWindowEnd: Date): void {
  if (scheduler.phase === 'private') {
    scheduler.privateWindowEndIso = nextWindowEnd.toISOString();
    return;
  }

  if (scheduler.phase === 'group_channel') {
    scheduler.groupChannelWindowEndIso = nextWindowEnd.toISOString();
  }
}

function advanceSchedulerPastPhase(scheduler: BackfillSchedulerState): void {
  if (scheduler.phase === 'private') {
    scheduler.phase = 'group_channel';
    scheduler.groupChannelWindowEndIso = new Date().toISOString();
    return;
  }

  scheduler.phase = 'complete';
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function maxDate(first: Date, second: Date): Date {
  return first > second ? first : second;
}

function tdMessageId(message: TdObject | undefined): number | undefined {
  return typeof message?.id === 'number' ? message.id : undefined;
}

function tdMessageDate(message: TdObject | undefined): Date | undefined {
  return typeof message?.date === 'number' && message.date > 0
    ? new Date(message.date * 1000)
    : undefined;
}

function isBeforeWindow(message: TdObject, window: BackfillWindow): boolean {
  const messageDate = tdMessageDate(message);
  return messageDate !== undefined && messageDate < window.start;
}

function oldestMessageIdOlderThan(
  messages: TdObject[],
  cursorMessageId: number
): number | undefined {
  const ids = messages
    .map(tdMessageId)
    .filter((id): id is number => id !== undefined && id < cursorMessageId);

  return ids.length === 0 ? undefined : Math.min(...ids);
}

async function invokeTdlib(client: TelegramClient, request: TdObject): Promise<unknown> {
  for (;;) {
    try {
      return await client.invoke(request as Parameters<TelegramClient['invoke']>[0]);
    } catch (error) {
      const floodWaitSeconds = parseFloodWaitSeconds(error);
      if (floodWaitSeconds === undefined) {
        throw error;
      }

      console.warn(
        JSON.stringify({
          event: 'telegram.flood_wait',
          request: request._,
          seconds: floodWaitSeconds
        })
      );
      await delay((floodWaitSeconds + 1) * 1000);
    }
  }
}

function parseFloodWaitSeconds(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/.exec(message);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}

function isTdObject(value: TdObject | undefined): value is TdObject {
  return value !== undefined;
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForShutdown(close: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      void close().finally(resolve);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}

function logSafeTelegramUpdate(update: unknown): void {
  const tdObject = asTdObject(update);
  if (tdObject === undefined) {
    return;
  }

  if (tdObject._ === 'updateAuthorizationState') {
    const authorizationState = asTdObject(tdObject.authorization_state);
    console.log(
      JSON.stringify({
        event: 'telegram.authorization_state',
        state: authorizationState?._ ?? 'unknown'
      })
    );
    return;
  }

  if (tdObject._ === 'updateConnectionState') {
    const connectionState = asTdObject(tdObject.state);
    console.log(
      JSON.stringify({
        event: 'telegram.connection_state',
        state: connectionState?._ ?? 'unknown'
      })
    );
  }
}

function summarizeCurrentUser(user: TdObject | undefined): Record<string, unknown> {
  return {
    id: user?.id,
    firstName: user?.first_name,
    lastName: user?.last_name,
    username: extractActiveUsername(user),
    isPremium: user?.is_premium
  };
}

function extractActiveUsername(user: TdObject | undefined): string | undefined {
  const usernames = asRecord(user?.usernames);
  const activeUsernames = usernames?.active_usernames;

  return Array.isArray(activeUsernames) && typeof activeUsernames[0] === 'string'
    ? activeUsernames[0]
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function isTelegramId(value: unknown): value is number {
  return typeof value === 'number';
}
