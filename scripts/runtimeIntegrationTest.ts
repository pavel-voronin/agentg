import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Server } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineInternalRpcDomain, defineModule, httpRpc, nats } from '@agentg/framework';

import { readConfig as readDataConfig } from '../packages/data/src/config.js';
import { moduleDefinition as dataModule } from '../packages/data/src/module.js';
import { readConfig as readRunnerConfig } from '../packages/llm-runner/src/config.js';
import { moduleDefinition as runnerModule } from '../packages/llm-runner/src/module.js';
import { readConfig as readPipelineConfig } from '../packages/pipelines/src/config.js';
import { moduleDefinition as pipelineModule } from '../packages/pipelines/src/module.js';
import { readConfig as readPolicyConfig } from '../packages/policies/src/config.js';
import { endpointModule as policyModule } from '../packages/policies/src/module.js';
import { readConfig as readTriggerConfig } from '../packages/triggers/src/config.js';
import { moduleDefinition as triggerModule } from '../packages/triggers/src/module.js';

type App = {
  stop(): Promise<void>;
};

type Dataset = {
  rows: DatasetRow[];
};

type DatasetRow = {
  lineage: ModelRef[];
  refs: Record<string, ModelRef>;
  value: unknown;
};

type ModelRef = {
  _model: string;
  id: string;
};

type TriggerProcedures = {
  listOccurrences(input?: { registrationKey?: string; status?: string }): Promise<{
    occurrences: {
      key: string;
      providerRunId?: string;
      registrationKey: string;
      registrationName: string;
      status: string;
    }[];
  }>;
  listTriggerRegistrations(input?: { owner?: { key?: string; module: string } }): Promise<{
    registrations: {
      key: string;
      name: string;
      owner: { key: string; module: string };
    }[];
  }>;
  runDueTriggers(): Promise<{
    claimed: number;
    dispatched: number;
  }>;
};

type PipelineProcedures = {
  getRun(input: { runId: string }): Promise<{
    nodes: {
      actionId: string;
      nodeId: string;
      outputDataset?: Dataset;
      status: string;
    }[];
    runId: string;
    status: string;
  } | null>;
  setPipeline(input: { document: string }): Promise<{
    error?: { code: string; message: string };
    name?: string;
    operation: 'set';
    status: 'applied' | 'rejected';
  }>;
};

type DataProcedures = {
  getAnnotation(input: { key: string; subject: ModelRef }): Promise<{
    key: string;
    subject: ModelRef;
    value: unknown;
  } | null>;
};

type ProviderRequest = {
  messages?: { content?: unknown; role?: string }[];
  model?: string;
};

type DataProviderCall = {
  input: unknown;
  procedure: string;
};

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://agentg:agentg@127.0.0.1:5432/agentg';
const natsUrl = process.env.NATS_URL ?? 'nats://127.0.0.1:4222';
const host = '127.0.0.1';
const chatRef: ModelRef = { _model: 'telegram.chat', id: '1001' };
const messageRef: ModelRef = { _model: 'telegram.message', id: '1001:42' };

const stopped: App[] = [];
let runnerConfigDirectory: string | undefined;
let provider: Awaited<ReturnType<typeof startProvider>> | undefined;

try {
  const runKey = `integration${randomUUID().replaceAll('-', '')}`;
  const dataProviderCalls: DataProviderCall[] = [];
  const ports = {
    data: await freePort(),
    llmProvider: await freePort(),
    policies: await freePort(),
    pipelines: await freePort(),
    runner: await freePort(),
    telegram: await freePort(),
    triggers: await freePort()
  };
  const urls = {
    data: `http://${host}:${String(ports.data)}`,
    pipelines: `http://${host}:${String(ports.pipelines)}`,
    policies: `http://${host}:${String(ports.policies)}`,
    runner: `http://${host}:${String(ports.runner)}`,
    telegram: `http://${host}:${String(ports.telegram)}`,
    triggers: `http://${host}:${String(ports.triggers)}`
  };

  provider = await startProvider(ports.llmProvider);
  await startTelegramDataProvider({
    calls: dataProviderCalls,
    port: ports.telegram,
    runKey
  });
  await startData({
    port: ports.data,
    telegramUrl: urls.telegram
  });
  await startRunner({
    port: ports.runner,
    providerUrl: provider.url
  });
  await startTriggers({
    pipelinesUrl: urls.pipelines,
    port: ports.triggers
  });
  await startPolicies({
    port: ports.policies
  });
  await startPipelines({
    dataUrl: urls.data,
    policiesUrl: urls.policies,
    port: ports.pipelines,
    runnerUrl: urls.runner,
    triggersUrl: urls.triggers
  });

  const pipelines = defineInternalRpcDomain<PipelineProcedures>('pipelines')({
    timeoutMs: 10_000,
    url: urls.pipelines
  });
  const triggers = defineInternalRpcDomain<TriggerProcedures>('triggers')({
    timeoutMs: 10_000,
    url: urls.triggers
  });
  const data = defineInternalRpcDomain<DataProcedures>('data')({
    timeoutMs: 10_000,
    url: urls.data
  });

  const setResult = await pipelines.setPipeline({
    document: pipelineDocument(runKey, new Date(Date.now() - 1000).toISOString())
  });
  assert(setResult.status === 'applied', `pipeline rejected: ${JSON.stringify(setResult)}`);

  const registration = await waitFor(async () => {
    const result = await triggers.listTriggerRegistrations({
      owner: {
        key: runKey,
        module: 'pipelines'
      }
    });
    return result.registrations.find((item) => item.name === 'unread') ?? null;
  }, 'trigger registration');

  const dispatch = await triggers.runDueTriggers();
  assert(dispatch.dispatched === 1, `trigger dispatch count: ${JSON.stringify(dispatch)}`);

  const occurrence = await waitFor(async () => {
    const result = await triggers.listOccurrences({
      registrationKey: registration.key
    });
    return result.occurrences.find((item) => item.status === 'accepted') ?? null;
  }, 'accepted trigger occurrence');

  assert(
    occurrence.providerRunId !== undefined,
    `accepted occurrence has no provider run id: ${JSON.stringify(occurrence)}`
  );
  const pipelineRunId = occurrence.providerRunId;

  const run = await waitFor(async () => {
    const result = await pipelines.getRun({
      runId: pipelineRunId
    });
    return result?.status === 'completed' ? result : null;
  }, 'completed pipeline run');

  const annotation = await waitFor(async () => {
    const result = await data.getAnnotation({
      key: runKey,
      subject: chatRef
    });
    return result?.value === `integration summary for ${runKey}` ? result : null;
  }, 'saved Data annotation');

  assert(
    dataProviderCalls.map((call) => call.procedure).join(',') === 'dataSelect,dataExpand',
    `unexpected Data provider calls: ${JSON.stringify(dataProviderCalls)}`
  );
  const providerCallCount = readProviderCallCount(provider);
  assert(providerCallCount === 1, `LLM provider call count: ${String(provider.calls.length)}`);
  const providerCall = provider.calls[0];
  assert(providerCall !== undefined, 'LLM provider call was not recorded');
  assert(providerCall.model === 'integration-model', 'LLM provider model was not used');
  assert(
    providerCall.messages?.[0]?.content ===
      'Return a short digest for the provided Telegram messages.',
    'LLM provider did not receive the pipeline prompt as the system message'
  );
  for (const nodeId of ['chats', 'messages', 'summarize', 'save']) {
    const node = run.nodes.find((item) => item.nodeId === nodeId);
    assert(
      node?.status === 'completed',
      `unexpected pipeline node status: ${JSON.stringify(run.nodes)}`
    );
  }

  await triggers.runDueTriggers();
  await sleep(300);
  const finalOccurrences = await triggers.listOccurrences({
    registrationKey: registration.key
  });
  assert(
    finalOccurrences.occurrences.filter((item) => item.status === 'accepted').length === 1,
    `duplicate accepted occurrences: ${JSON.stringify(finalOccurrences)}`
  );
  assert(
    readProviderCallCount(provider) === providerCallCount,
    'second trigger sweep called the LLM provider again'
  );

  console.log(
    JSON.stringify(
      {
        annotationKey: annotation.key,
        occurrenceKey: occurrence.key,
        pipelineRunId,
        status: 'ok'
      },
      null,
      2
    )
  );
} finally {
  for (const app of stopped.reverse()) {
    await app.stop();
  }
  await provider?.stop();
  if (runnerConfigDirectory !== undefined) {
    await rm(runnerConfigDirectory, {
      force: true,
      recursive: true
    });
  }
}

function pipelineDocument(name: string, startAt: string): string {
  return `apiVersion: agentg.dev/v1
kind: Pipeline
metadata:
  name: ${name}
spec:
  triggers:
    unread:
      kind: periodic
      everySeconds: 3600
      startAt: "${startAt}"
  nodes:
    chats:
      use: data.select
      with:
        model: telegram.chat
        where:
          readState: unread
        limit: 1
    messages:
      use: data.expand
      from: chats
      with:
        sourceRef: chat
        relation: messages
        where:
          readState: unread
        limit: 5
    summarize:
      use: llm.run
      from: messages
      with:
        profile: integration
        prompt: Return a short digest for the provided Telegram messages.
    save:
      use: data.writeAnnotation
      from: summarize
      with:
        key: ${name}
        mode: replace
        subject:
          ref: chat
`;
}

async function startTelegramDataProvider(input: {
  calls: DataProviderCall[];
  port: number;
  runKey: string;
}): Promise<void> {
  const sourceModule = defineModule('telegram', {
    config: () => ({}),
    setup() {
      return {
        dataExpand(rawInput: unknown) {
          input.calls.push({
            input: rawInput,
            procedure: 'dataExpand'
          });
          const request = rawInput as {
            from?: DatasetRow[];
            limit?: number;
            relation?: string;
            sourceRef?: string;
            where?: { readState?: string };
          };
          assert(
            request.relation === 'messages',
            `unexpected relation: ${String(request.relation)}`
          );
          assert(
            request.sourceRef === 'chat',
            `unexpected sourceRef: ${String(request.sourceRef)}`
          );
          assert(request.where?.readState === 'unread', 'message selector did not request unread');
          assert(request.from?.[0]?.refs.chat?.id === chatRef.id, 'expand input has no chat ref');
          return {
            rows: [
              {
                lineage: [chatRef, messageRef],
                refs: {
                  chat: chatRef,
                  message: messageRef
                },
                value: {
                  chatId: chatRef.id,
                  messageId: '42',
                  text: `message payload for ${input.runKey}`
                }
              }
            ]
          };
        },
        dataGet(rawInput: unknown) {
          const request = rawInput as { ref?: ModelRef };
          if (request.ref?._model === chatRef._model && request.ref.id === chatRef.id) {
            return {
              lineage: [chatRef],
              refs: { chat: chatRef },
              value: {
                id: chatRef.id,
                title: 'Subcreative Community'
              }
            };
          }
          return null;
        },
        dataRender(rawInput: unknown) {
          const request = rawInput as { from?: DatasetRow[] };
          return {
            rows: (request.from ?? []).map((row) => ({
              lineage: row.lineage,
              refs: row.refs,
              value: JSON.stringify(row.value)
            }))
          };
        },
        dataSelect(rawInput: unknown) {
          input.calls.push({
            input: rawInput,
            procedure: 'dataSelect'
          });
          const request = rawInput as {
            limit?: number;
            model?: string;
            where?: { readState?: string };
          };
          assert(request.model === 'telegram.chat', `unexpected model: ${String(request.model)}`);
          assert(request.where?.readState === 'unread', 'chat selector did not request unread');
          return {
            rows: [
              {
                lineage: [chatRef],
                refs: {
                  chat: chatRef
                },
                value: {
                  id: chatRef.id,
                  title: 'Subcreative Community',
                  unreadCount: 1
                }
              }
            ]
          };
        }
      };
    }
  });
  const app = sourceModule({
    config: {},
    connect: {
      events: nats(natsUrl),
      rpc: httpRpc({
        host,
        port: input.port,
        service: 'telegram'
      })
    }
  });
  await app.start();
  stopped.push(app);
}

async function startData(input: { port: number; telegramUrl: string }): Promise<void> {
  const config = readDataConfig({
    DATA_PROVIDER_TARGETS: JSON.stringify({
      telegram: input.telegramUrl
    }),
    DATABASE_URL: databaseUrl,
    NATS_URL: natsUrl,
    PORT: String(input.port)
  });
  const app = dataModule({
    config,
    connect: {
      events: nats(config.natsUrl),
      rpc: httpRpc({
        host,
        port: config.port,
        service: 'data'
      })
    }
  });
  await app.start();
  stopped.push(app);
}

async function startRunner(input: { port: number; providerUrl: string }): Promise<void> {
  runnerConfigDirectory = await mkdtemp(join(tmpdir(), 'agentg-llm-runner-integration-'));
  const profilesPath = join(runnerConfigDirectory, 'profiles.yaml');
  await writeFile(
    profilesPath,
    `profiles:
  integration:
    adapter: openai-compatible
    baseUrl: ${input.providerUrl}
    model: integration-model
    timeoutMs: 5000
`,
    'utf8'
  );
  const config = readRunnerConfig({
    DATABASE_URL: databaseUrl,
    LLM_RUNNER_PROFILES_PATH: profilesPath,
    LLM_RUNNER_WORKER_INTERVAL_MS: '100',
    NATS_URL: natsUrl,
    PORT: String(input.port)
  });
  const app = runnerModule({
    config,
    connect: {
      events: nats(config.natsUrl),
      rpc: httpRpc({
        host,
        port: config.port,
        service: 'llm-runner'
      })
    }
  });
  await app.start();
  stopped.push(app);
}

async function startPipelines(input: {
  dataUrl: string;
  policiesUrl: string;
  port: number;
  runnerUrl: string;
  triggersUrl: string;
}): Promise<void> {
  const config = readPipelineConfig({
    DATABASE_URL: databaseUrl,
    NATS_URL: natsUrl,
    PIPELINES_ACTION_TARGETS: JSON.stringify({
      data: input.dataUrl,
      'llm-runner': input.runnerUrl
    }),
    PORT: String(input.port),
    POLICIES_RPC_URL: input.policiesUrl,
    TRIGGERS_RPC_URL: input.triggersUrl
  });
  const app = pipelineModule({
    config,
    connect: {
      events: nats(config.natsUrl),
      rpc: httpRpc({
        host,
        port: config.port,
        service: 'pipelines'
      })
    }
  });
  await app.start();
  stopped.push(app);
}

async function startPolicies(input: { port: number }): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'agentg-policies-'));
  const config = readPolicyConfig({
    NATS_URL: natsUrl,
    POLICY_CONFIG_DIR: directory,
    PORT: String(input.port)
  });
  const app = policyModule({
    config,
    connect: {
      events: nats(config.natsUrl),
      rpc: httpRpc({
        host,
        port: config.port,
        service: 'policies'
      })
    }
  });
  await app.start();
  stopped.push({
    async stop() {
      await app.stop();
      await rm(directory, { force: true, recursive: true });
    }
  });
}

async function startTriggers(input: { pipelinesUrl: string; port: number }): Promise<void> {
  const config = readTriggerConfig({
    DATABASE_URL: databaseUrl,
    NATS_URL: natsUrl,
    PORT: String(input.port),
    TRIGGERS_ACTION_TARGETS: JSON.stringify({
      pipelines: input.pipelinesUrl
    }),
    TRIGGERS_SCHEDULER_INTERVAL_MS: '60000'
  });
  const app = triggerModule({
    config,
    connect: {
      events: nats(config.natsUrl),
      rpc: httpRpc({
        host,
        port: config.port,
        service: 'triggers'
      })
    }
  });
  await app.start();
  stopped.push(app);
}

async function startProvider(port: number): Promise<{
  calls: ProviderRequest[];
  stop(): Promise<void>;
  url: string;
}> {
  const calls: ProviderRequest[] = [];
  const server = createServer((request, response) => {
    void handleProviderRequest(request, response, calls).catch((error: unknown) => {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  });
  await listen(server, port);
  return {
    calls,
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
    url: `http://${host}:${String(port)}`
  };
}

async function handleProviderRequest(
  request: IncomingMessage,
  response: ServerResponse,
  calls: ProviderRequest[]
): Promise<void> {
  if (request.method !== 'POST' || request.url !== '/chat/completions') {
    writeJson(response, 404, {
      error: 'not found'
    });
    return;
  }
  const body = JSON.parse(await readBody(request)) as ProviderRequest;
  calls.push(body);
  const userMessage = body.messages?.find((message) => message.role === 'user')?.content;
  assert(typeof userMessage === 'string', 'LLM provider did not receive user payload');
  const parsed = JSON.parse(userMessage) as {
    value?: {
      text?: unknown;
    };
  };
  const text = parsed.value?.text;
  assert(typeof text === 'string', 'LLM provider user payload has no message text');
  const runKey = text.replace('message payload for ', '');
  writeJson(response, 200, {
    choices: [
      {
        message: {
          content: `integration summary for ${runKey}`
        }
      }
    ],
    id: `chatcmpl-${runKey}`,
    object: 'chat.completion'
  });
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json'
  });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
    } else {
      throw new Error('Provider request body chunk has unsupported type');
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function freePort(): Promise<number> {
  const server = new Server();
  await listen(server, 0);
  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  assert(typeof address === 'object' && address !== null, 'free port address is not available');
  return address.port;
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function waitFor<T>(read: () => Promise<T | null>, label: string): Promise<T> {
  const started = Date.now();
  let last: T | null = null;
  while (Date.now() - started < 10_000) {
    last = await read();
    if (last !== null) {
      return last;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(last)}`);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function readProviderCallCount(provider: { calls: readonly ProviderRequest[] }): number {
  return provider.calls.length;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
