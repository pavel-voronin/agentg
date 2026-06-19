import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Server } from 'node:net';

import { defineInternalRpcDomain, defineModule, httpRpc, nats } from '@agentg/framework';
import { createPolicyClient, POLICY_API_VERSION } from '@agentg/framework/policies';

import { readConfig as readRunnerConfig } from '../packages/llm-runner/src/config.js';
import { moduleDefinition as runnerModule } from '../packages/llm-runner/src/module.js';
import { readConfig as readPoliciesConfig } from '../packages/policies/src/config.js';
import { endpointModule as policiesModule } from '../packages/policies/src/module.js';
import { readConfig as readTriggerConfig } from '../packages/triggers/src/config.js';
import { moduleDefinition as triggerModule } from '../packages/triggers/src/module.js';

type App = {
  stop(): Promise<void>;
};

type TriggerProcedures = {
  listOccurrences(input?: { registrationKey?: string; status?: string }): Promise<{
    occurrences: {
      key: string;
      providerRunId?: string;
      registrationKey: string;
      ruleName: string;
      status: string;
    }[];
  }>;
  listTriggerRegistrations(): Promise<{
    registrations: {
      key: string;
      rule: {
        name: string;
      };
    }[];
  }>;
  runDueTriggers(): Promise<{
    claimed: number;
    dispatched: number;
  }>;
};

type RunnerProcedures = {
  getCurrentArtifact(input: {
    artifactKey: string;
    sourceRef: {
      _model: string;
      id: string;
    };
  }): Promise<{
    artifact: {
      artifactKey: string;
      body: string;
      profile: string;
      sourceRef: {
        _model: string;
        id: string;
      };
    } | null;
  }>;
};

type SourceResolutionInput = {
  sourceSelector: {
    domain: string;
    selector: unknown;
  };
};

type ProviderRequest = {
  messages?: { content?: unknown; role?: string }[];
  model?: string;
};

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://agentg:agentg@127.0.0.1:5432/agentg';
const natsUrl = process.env.NATS_URL ?? 'nats://127.0.0.1:4222';
const host = '127.0.0.1';
const sourceCalls: SourceResolutionInput[] = [];

const stopped: App[] = [];
let policyDirectory: string | undefined;
let provider: Awaited<ReturnType<typeof startProvider>> | undefined;

try {
  const runKey = `integration${randomUUID().replaceAll('-', '')}`;
  const ports = {
    policies: await freePort(),
    provider: await freePort(),
    runner: await freePort(),
    source: await freePort(),
    triggers: await freePort()
  };
  const urls = {
    policies: `http://${host}:${String(ports.policies)}`,
    runner: `http://${host}:${String(ports.runner)}`,
    source: `http://${host}:${String(ports.source)}`
  };

  policyDirectory = await mkdtemp(join(tmpdir(), 'agentg-policies-integration-'));
  provider = await startProvider(ports.provider);

  await startSourceModule({
    port: ports.source,
    runKey,
    seen: sourceCalls
  });
  await startRunner({
    port: ports.runner,
    providerUrl: provider.url,
    sourceUrl: urls.source
  });
  await startPolicies({
    directory: policyDirectory,
    port: ports.policies
  });

  const policy = createPolicyClient({ timeoutMs: 5000, url: urls.policies });
  const policyResult = await policy.setInstance({
    document: {
      apiVersion: POLICY_API_VERSION,
      kind: 'TriggerRule',
      metadata: {
        labels: {
          integration: runKey
        },
        name: runKey
      },
      spec: {
        action: {
          input: {
            artifactKey: runKey,
            instructions: 'Return a short digest for the provided Telegram messages.',
            profile: 'integration',
            sourceSelector: {
              domain: 'telegram',
              selector: {
                chatId: '1001',
                kind: 'recentMessages',
                limit: 10
              }
            }
          },
          module: 'llm-runner',
          procedure: 'runTriggered'
        },
        condition: {
          everySeconds: 3600,
          kind: 'periodic',
          startAt: new Date(Date.now() - 1000).toISOString()
        }
      }
    }
  });
  assert(policyResult.status === 'applied', `policy rejected: ${JSON.stringify(policyResult)}`);
  const triggerPolicyValue = await policy.getPolicyValue({
    kind: 'TriggerRule'
  });
  assert(
    Array.isArray(triggerPolicyValue) &&
      triggerPolicyValue.length === 1 &&
      isRecord(triggerPolicyValue[0]) &&
      triggerPolicyValue[0].name === runKey,
    `trigger policy value was not resolved: ${JSON.stringify(triggerPolicyValue)}`
  );

  await startTriggers({
    policiesUrl: urls.policies,
    port: ports.triggers,
    runnerUrl: urls.runner
  });

  const triggers = defineInternalRpcDomain<TriggerProcedures>('triggers')({
    timeoutMs: 5000,
    url: `http://${host}:${String(ports.triggers)}`
  });
  const runner = defineInternalRpcDomain<RunnerProcedures>('llm-runner')({
    timeoutMs: 5000,
    url: urls.runner
  });

  const registration = await waitFor(async () => {
    const result = await triggers.listTriggerRegistrations();
    return result.registrations.find((item) => item.rule.name === runKey) ?? null;
  }, 'trigger registration');

  await triggers.runDueTriggers();

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

  const artifact = await waitFor(async () => {
    const result = await runner.getCurrentArtifact({
      artifactKey: runKey,
      sourceRef: {
        _model: 'telegram.chat',
        id: '1001'
      }
    });
    return result.artifact;
  }, 'current LLM artifact');

  assert(
    artifact.body === `integration summary for ${runKey}`,
    `unexpected artifact: ${artifact.body}`
  );
  assert(artifact.profile === 'integration', `unexpected artifact profile: ${artifact.profile}`);
  assert(sourceCalls.length === 1, `source resolver call count: ${String(sourceCalls.length)}`);
  const providerCallCount = provider.calls.length;
  assert(providerCallCount === 1, `LLM provider call count: ${String(provider.calls.length)}`);
  const providerCall = provider.calls[0];
  assert(providerCall !== undefined, 'LLM provider call was not recorded');
  assert(providerCall.model === 'integration-model', 'LLM provider model was not used');
  assert(
    providerCall.messages?.[0]?.content ===
      'Return a short digest for the provided Telegram messages.',
    'LLM provider did not receive instructions as the system message'
  );

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
    provider.calls.length === providerCallCount,
    'second trigger sweep called the LLM provider again'
  );

  console.log(
    JSON.stringify(
      {
        artifactKey: artifact.artifactKey,
        occurrenceKey: occurrence.key,
        providerRunId: occurrence.providerRunId,
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
  if (policyDirectory !== undefined) {
    await rm(policyDirectory, {
      force: true,
      recursive: true
    });
  }
}

async function startSourceModule(input: {
  port: number;
  runKey: string;
  seen: SourceResolutionInput[];
}): Promise<void> {
  const sourceModule = defineModule('telegram', {
    config: () => ({}),
    setup() {
      return {
        resolveSourceContent(rawInput: unknown) {
          const request = rawInput as SourceResolutionInput;
          input.seen.push(request);
          assert(
            request.sourceSelector.domain === 'telegram',
            `unexpected source domain: ${request.sourceSelector.domain}`
          );
          return {
            snapshot: {
              contentRefs: [
                {
                  _model: 'telegram.message',
                  id: '1001:42',
                  sourceRef: {
                    _model: 'telegram.chat',
                    id: '1001'
                  }
                }
              ],
              payload: {
                messages: [
                  {
                    chatId: '1001',
                    messageId: '42',
                    text: `message payload for ${input.runKey}`
                  }
                ]
              },
              sourceRefs: [
                {
                  _model: 'telegram.chat',
                  id: '1001'
                }
              ]
            },
            status: 'ready'
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

async function startRunner(input: {
  port: number;
  providerUrl: string;
  sourceUrl: string;
}): Promise<void> {
  const config = readRunnerConfig({
    DATABASE_URL: databaseUrl,
    LLM_RUNNER_PROFILES: JSON.stringify({
      integration: {
        adapter: 'openai-compatible',
        baseUrl: input.providerUrl,
        model: 'integration-model',
        timeoutMs: 5000
      }
    }),
    LLM_RUNNER_SOURCE_RESOLVERS: JSON.stringify({
      telegram: {
        procedure: 'resolveSourceContent',
        timeoutMs: 5000,
        url: input.sourceUrl
      }
    }),
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

async function startPolicies(input: { directory: string; port: number }): Promise<void> {
  const config = readPoliciesConfig({
    NATS_URL: natsUrl,
    POLICY_CONFIG_DIR: input.directory,
    PORT: String(input.port)
  });
  const app = policiesModule({
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
  stopped.push(app);
}

async function startTriggers(input: {
  policiesUrl: string;
  port: number;
  runnerUrl: string;
}): Promise<void> {
  const config = readTriggerConfig({
    DATABASE_URL: databaseUrl,
    NATS_URL: natsUrl,
    POLICIES_RPC_URL: input.policiesUrl,
    PORT: String(input.port),
    TRIGGERS_ACTION_TARGETS: JSON.stringify({
      'llm-runner': input.runnerUrl
    }),
    TRIGGERS_SCHEDULER_INTERVAL_MS: '100'
  });
  const app = triggerModule({
    config,
    connect: {
      events: nats(config.natsUrl),
      policies: () =>
        createPolicyClient({
          timeoutMs: 5000,
          url: config.policiesRpcUrl
        }),
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
    payload?: {
      messages?: {
        text?: unknown;
      }[];
    };
  };
  const text = parsed.payload?.messages?.[0]?.text;
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
