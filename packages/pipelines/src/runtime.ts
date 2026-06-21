import type { Dispatcher, ResultReader } from './actions.js';
import { executionOrder, parseDefinition } from './definition.js';
import {
  recordCurrentStats,
  recordNodeDispatched,
  recordRunStarted,
  timeNode
} from './telemetry.js';
import type { RegistrationClient } from './triggers.js';
import {
  getRunInputSchema,
  listRunsInputSchema,
  nameInputSchema,
  providerRunEventSchema,
  runInputSchema,
  setInputSchema,
  triggeredInputSchema,
  type Dataset,
  type Document
} from './schema.js';
import type { NodeRecord, RunRecord, Store } from './store.js';

export type Runtime = ReturnType<typeof createRuntime>;

type RuntimeInput = {
  dispatcher: Dispatcher;
  registration: RegistrationClient;
  results: ResultReader;
  store: Store;
};

type ExecutionInput = Pick<RuntimeInput, 'dispatcher' | 'results' | 'store'>;
type ProviderReadResult =
  | { dataset: Dataset; status: 'completed' }
  | { code: string; message: string; status: 'failed' }
  | { status: 'waiting' };
type ResumeResult =
  | { definitionSnapshot: Document; runId: string; status: 'completed' }
  | { status: 'failed' | 'waiting' }
  | null;

export function createRuntime(input: RuntimeInput) {
  let queue = Promise.resolve();

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.catch(() => undefined).then(operation);
    queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  return {
    deletePipeline(rawInput: unknown) {
      return serialize(async () => {
        let name: string | undefined;
        try {
          const request = nameInputSchema.parse(rawInput);
          name = request.name;
          await input.registration.replace(null, request.name);
          await input.store.deleteDefinition(request.name);
          await recordCurrentStats(() => input.store.readStats());
          return {
            name: request.name,
            operation: 'delete' as const,
            status: 'applied' as const
          };
        } catch (error) {
          return {
            error: {
              code: 'pipeline_rejected',
              message: error instanceof Error ? error.message : String(error)
            },
            ...(name === undefined ? {} : { name }),
            operation: 'delete' as const,
            status: 'rejected' as const
          };
        }
      });
    },
    getPipeline(rawInput: unknown) {
      const request = nameInputSchema.parse(rawInput);
      return input.store.getDefinition(request.name);
    },
    getRun(rawInput: unknown) {
      const request = getRunInputSchema.parse(rawInput);
      return runView(input.store, request.runId);
    },
    listPipelines() {
      return input.store.listDefinitions();
    },
    async listRuns(rawInput: unknown) {
      const runs = await input.store.listRuns(listRunsInputSchema.parse(rawInput));
      const views = await Promise.all(runs.map((run) => runView(input.store, run.runId)));
      return views.filter((view) => view !== null);
    },
    async resumeProviderRun(rawInput: unknown) {
      const result = await resumeProviderRun(input, rawInput, serialize);
      if (result?.status === 'completed') {
        await executeRun(input, result.runId, result.definitionSnapshot);
      }
    },
    async resumeWaitingRuns() {
      const results = await resumeWaitingRuns(input, serialize);
      for (const result of results) {
        if (result?.status === 'completed') {
          await executeRun(input, result.runId, result.definitionSnapshot);
        }
      }
    },
    async runPipeline(rawInput: unknown) {
      const request = runInputSchema.parse(rawInput);
      const run = await startRun(input, {
        idempotencyKey: request.idempotencyKey,
        name: request.name,
        serialize,
        source: 'manual'
      });
      return {
        runId: run.runId,
        status: 'accepted' as const
      };
    },
    async runTriggered(rawInput: unknown) {
      const request = triggeredInputSchema.parse(rawInput);
      try {
        const run = await startRun(input, {
          idempotencyKey: request.occurrence.idempotencyKey,
          name: request.actionInput.pipelineName,
          serialize,
          source: 'triggered',
          triggerName: request.actionInput.triggerName
        });
        return {
          runId: run.runId,
          status: 'accepted' as const
        };
      } catch (error) {
        return {
          error: {
            code: 'pipeline_trigger_rejected',
            message: error instanceof Error ? error.message : String(error)
          },
          status: 'rejected' as const
        };
      }
    },
    setPipeline(rawInput: unknown) {
      return serialize(async () => {
        try {
          const request = setInputSchema.parse(rawInput);
          const parsed = parseDefinition(request.document);
          const bindings = await input.registration.replace(
            parsed.document,
            parsed.document.metadata.name
          );
          await input.store.replaceDefinition({
            bindings,
            document: parsed.document,
            now: new Date(),
            yaml: parsed.yaml
          });
          await recordCurrentStats(() => input.store.readStats());
          return {
            name: parsed.document.metadata.name,
            operation: 'set' as const,
            status: 'applied' as const
          };
        } catch (error) {
          return {
            error: {
              code: 'pipeline_rejected',
              message: error instanceof Error ? error.message : String(error)
            },
            operation: 'set' as const,
            status: 'rejected' as const
          };
        }
      });
    }
  };
}

async function startRun(
  input: ExecutionInput,
  request: {
    idempotencyKey?: string | undefined;
    name: string;
    serialize<T>(operation: () => Promise<T>): Promise<T>;
    triggerName?: string | undefined;
    source: 'manual' | 'triggered';
  }
): Promise<RunRecord> {
  const result = await request.serialize(async () => {
    const definition = await input.store.getDefinition(request.name);
    if (definition === null) {
      throw new Error(`Pipeline is not found: ${request.name}`);
    }
    return input.store.createRun({
      definition: definition.document,
      idempotencyKey: request.idempotencyKey,
      name: request.name,
      now: new Date(),
      triggerName: request.triggerName
    });
  });
  if (result.created) {
    recordRunStarted(request.source);
    await recordCurrentStats(() => input.store.readStats());
    await executeRun(input, result.run.runId, result.run.definitionSnapshot);
  }
  return (await input.store.getRun(result.run.runId)) ?? result.run;
}

async function resumeProviderRun(
  input: ExecutionInput,
  rawInput: unknown,
  serialize: <T>(operation: () => Promise<T>) => Promise<T>
): Promise<ResumeResult> {
  const event = providerRunEventSchema.parse(rawInput);
  return serialize(async () => {
    const node = await input.store.findWaitingNode({
      nodeId: event.nodeId,
      providerRunId: event.runId,
      runId: event.pipelineRunId
    });
    return node === null ? null : settleWaitingNode(input, node);
  });
}

async function resumeWaitingRuns(
  input: ExecutionInput,
  serialize: <T>(operation: () => Promise<T>) => Promise<T>
): Promise<readonly ResumeResult[]> {
  const nodes = await input.store.listWaitingNodes();
  const results: ResumeResult[] = [];
  for (const node of nodes) {
    results.push(await serialize(() => settleWaitingNode(input, node)));
  }
  return results;
}

async function settleWaitingNode(input: ExecutionInput, node: NodeRecord): Promise<ResumeResult> {
  if (node.providerRunId === undefined) {
    throw new Error(`Waiting pipeline node has no provider run id: ${node.runId}/${node.nodeId}`);
  }
  const resolved = await readProviderResult(input, {
    actionId: node.actionId,
    providerRunId: node.providerRunId
  });
  if (resolved.status === 'waiting') {
    return { status: 'waiting' };
  }
  if (resolved.status === 'failed') {
    const settled = await input.store.failWaitingNode({
      code: resolved.code,
      message: resolved.message,
      nodeId: node.nodeId,
      providerRunId: node.providerRunId,
      runId: node.runId
    });
    if (!settled) {
      await recordCurrentStats(() => input.store.readStats());
      return null;
    }
    await input.store.markRunFailed({
      code: resolved.code,
      message: resolved.message,
      runId: node.runId
    });
    await recordCurrentStats(() => input.store.readStats());
    return { status: 'failed' };
  }
  const settled = await input.store.completeWaitingNode({
    dataset: resolved.dataset,
    nodeId: node.nodeId,
    providerRunId: node.providerRunId,
    runId: node.runId
  });
  if (!settled) {
    await recordCurrentStats(() => input.store.readStats());
    return null;
  }
  const run = await input.store.getRun(node.runId);
  if (run === null || run.status === 'completed' || run.status === 'failed') {
    await recordCurrentStats(() => input.store.readStats());
    return null;
  }
  await recordCurrentStats(() => input.store.readStats());
  return {
    definitionSnapshot: run.definitionSnapshot,
    runId: run.runId,
    status: 'completed'
  };
}

async function readProviderResult(
  input: ExecutionInput,
  request: { actionId: string; providerRunId: string }
): Promise<ProviderReadResult> {
  const result = await input.results.read(request);
  if (result.runId !== request.providerRunId) {
    return {
      code: 'provider_result_mismatch',
      message: `Provider result run id mismatch: expected ${request.providerRunId}, got ${result.runId}`,
      status: 'failed'
    };
  }
  if (result.status === 'failed') {
    return {
      code: result.error.code,
      message: result.error.message,
      status: 'failed'
    };
  }
  if (result.status === 'completed') {
    return {
      dataset: result.dataset,
      status: 'completed'
    };
  }
  return { status: 'waiting' };
}

async function executeRun(input: ExecutionInput, runId: string, document: Document): Promise<void> {
  await input.store.markRunStatus({ runId, status: 'running' });
  const existingNodes = new Map(
    (await input.store.listNodeRuns(runId)).map((node) => [node.nodeId, node])
  );
  const outputs = new Map<string, Dataset>();
  let activeNodeId: string | undefined;

  try {
    for (const nodeId of executionOrder(document)) {
      activeNodeId = nodeId;
      const node = document.spec.nodes[nodeId];
      if (node === undefined) {
        throw new Error(`Pipeline node is missing: ${nodeId}`);
      }

      const existing = existingNodes.get(nodeId);
      if (existing !== undefined) {
        const action = await existingNodeAction(input.store, outputs, existing);
        if (action === 'stop') {
          return;
        }
        if (action === 'skip') {
          activeNodeId = undefined;
          continue;
        }
      }

      const dataset = node.from === undefined ? emptyDataset() : requiredOutput(outputs, node.from);
      await input.store.markNodeRunning({
        actionId: node.use,
        dataset,
        nodeId,
        runId
      });

      const result = await timeNode(node.use, () =>
        input.dispatcher.dispatch({
          actionId: node.use,
          dataset,
          nodeId,
          runId,
          withInput: node.with
        })
      );
      recordNodeDispatched(node.use, result.status);
      if (result.status === 'ready') {
        outputs.set(nodeId, result.dataset);
        await input.store.markNodeCompleted({
          dataset: result.dataset,
          nodeId,
          providerRunId: result.runId,
          runId
        });
        activeNodeId = undefined;
        continue;
      }
      if (result.status === 'accepted') {
        await input.store.markNodeAccepted({
          nodeId,
          providerRunId: result.runId,
          runId
        });
        await input.store.markRunStatus({ runId, status: 'waiting' });
        await recordCurrentStats(() => input.store.readStats());
        return;
      }
      await input.store.markNodeFailed({
        code: result.error.code,
        message: result.error.message,
        nodeId,
        runId
      });
      await input.store.markRunFailed({
        code: result.error.code,
        message: result.error.message,
        runId
      });
      await recordCurrentStats(() => input.store.readStats());
      return;
    }

    await input.store.markRunStatus({ runId, status: 'completed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (activeNodeId !== undefined) {
      await input.store.markNodeFailed({
        code: 'pipeline_node_failed',
        message,
        nodeId: activeNodeId,
        runId
      });
    }
    await input.store.markRunFailed({
      code: 'pipeline_failed',
      message,
      runId
    });
  } finally {
    await recordCurrentStats(() => input.store.readStats());
  }
}

async function existingNodeAction(
  store: Store,
  outputs: Map<string, Dataset>,
  node: NodeRecord
): Promise<'run' | 'skip' | 'stop'> {
  if (node.status === 'completed') {
    if (node.outputDataset === undefined) {
      await store.markRunFailed({
        code: 'pipeline_node_output_missing',
        message: `Completed pipeline node has no output dataset: ${node.nodeId}`,
        runId: node.runId
      });
      return 'stop';
    }
    outputs.set(node.nodeId, node.outputDataset);
    return 'skip';
  }
  if (node.status === 'waiting') {
    return 'stop';
  }
  if (node.status === 'failed') {
    await store.markRunFailed({
      code: node.failureCode ?? 'pipeline_node_failed',
      message: node.failureMessage ?? `Pipeline node failed: ${node.nodeId}`,
      runId: node.runId
    });
    return 'stop';
  }
  return 'run';
}

async function runView(store: Store, runId: string) {
  const run = await store.getRun(runId);
  if (run === null) {
    return null;
  }
  return {
    ...run,
    nodes: await store.listNodeRuns(runId)
  };
}

function requiredOutput(outputs: Map<string, Dataset>, nodeId: string): Dataset {
  const dataset = outputs.get(nodeId);
  if (dataset === undefined) {
    throw new Error(`Pipeline node output is not available: ${nodeId}`);
  }
  return dataset;
}

function emptyDataset(): Dataset {
  return {
    rows: []
  };
}
