import { describe, expect, it } from 'vitest';

import { callTool, tools } from './server.js';

type CallRecord = {
  method: string;
  params?: unknown;
};

function createBridge() {
  const calls: CallRecord[] = [];
  return {
    bridge: {
      call(method: string, params?: unknown): Promise<unknown> {
        calls.push(params === undefined ? { method } : { method, params });
        return Promise.resolve({ ok: true });
      },
      readEvents(): readonly Record<string, unknown>[] {
        return [];
      },
      status(): Record<string, unknown> {
        return { connected: true };
      }
    },
    calls
  };
}

describe('Codex MCP tools', () => {
  it('exposes explicit Data and Pipeline tools without a generic Gateway caller', () => {
    const names = tools.map((tool) => tool.name);

    expect(names).toContain('agentg_gateway_status');
    expect(names).not.toContain('gateway_call');
    expect(names).not.toContain('telegram_resolve_source_content');
    expect(names.filter((name) => name.startsWith('data_')).sort()).toEqual([
      'data_expand',
      'data_get',
      'data_get_annotation',
      'data_get_collection_item',
      'data_list_annotations',
      'data_list_collection',
      'data_list_models',
      'data_render',
      'data_select',
      'data_write_annotation',
      'data_write_collection_item'
    ]);
    expect(names.filter((name) => name.startsWith('pipelines_')).sort()).toEqual([
      'pipelines_delete_pipeline',
      'pipelines_describe_spec',
      'pipelines_get_pipeline',
      'pipelines_get_run',
      'pipelines_list_pipelines',
      'pipelines_list_runs',
      'pipelines_run_pipeline',
      'pipelines_set_pipeline'
    ]);
  });

  it('routes every Data and Pipeline tool to the documented Gateway method', async () => {
    const { bridge, calls } = createBridge();
    const subject = { _model: 'telegram.chat', id: 'chat-1' };
    const row = {
      lineage: [subject],
      refs: { chat: subject },
      value: { title: 'Subcreative Community' }
    };

    const cases: {
      args: Record<string, unknown>;
      method: string;
      params?: unknown;
      tool: string;
    }[] = [
      { args: {}, method: 'data.listModels', tool: 'data_list_models' },
      {
        args: { model: 'telegram.chat', where: true },
        method: 'data.select',
        params: { model: 'telegram.chat', where: true },
        tool: 'data_select'
      },
      {
        args: { ref: subject },
        method: 'data.get',
        params: { ref: subject },
        tool: 'data_get'
      },
      {
        args: { from: [row], relation: 'messages', sourceRef: 'chat', where: 'unread' },
        method: 'data.expand',
        params: { from: [row], relation: 'messages', sourceRef: 'chat', where: 'unread' },
        tool: 'data_expand'
      },
      {
        args: { format: 'text', from: [row], options: ['chat'], sourceRef: 'message' },
        method: 'data.render',
        params: { format: 'text', from: [row], options: ['chat'], sourceRef: 'message' },
        tool: 'data_render'
      },
      {
        args: { key: 'summary', subject },
        method: 'data.getAnnotation',
        params: { key: 'summary', subject },
        tool: 'data_get_annotation'
      },
      {
        args: { key: 'summary', subject },
        method: 'data.listAnnotations',
        params: { key: 'summary', subject },
        tool: 'data_list_annotations'
      },
      {
        args: { key: 'summary', mode: 'replace', subject, value: 'ok' },
        method: 'data.writeAnnotation',
        params: { key: 'summary', mode: 'replace', subject, value: 'ok' },
        tool: 'data_write_annotation'
      },
      {
        args: { key: 'subjects', subject },
        method: 'data.listCollection',
        params: { key: 'subjects', subject },
        tool: 'data_list_collection'
      },
      {
        args: { itemId: 'pricing', key: 'subjects', subject },
        method: 'data.getCollectionItem',
        params: { itemId: 'pricing', key: 'subjects', subject },
        tool: 'data_get_collection_item'
      },
      {
        args: { key: 'subjects', mode: 'append', subject, value: { title: 'Pricing' } },
        method: 'data.writeCollectionItem',
        params: { key: 'subjects', mode: 'append', subject, value: { title: 'Pricing' } },
        tool: 'data_write_collection_item'
      },
      {
        args: {
          itemId: 'pricing',
          key: 'subjects',
          mode: 'merge',
          subject,
          value: { title: 'Pricing' }
        },
        method: 'data.writeCollectionItem',
        params: {
          itemId: 'pricing',
          key: 'subjects',
          mode: 'merge',
          subject,
          value: { title: 'Pricing' }
        },
        tool: 'data_write_collection_item'
      },
      { args: {}, method: 'pipelines.listPipelines', tool: 'pipelines_list_pipelines' },
      { args: {}, method: 'pipelines.describeSpec', tool: 'pipelines_describe_spec' },
      {
        args: { name: 'digest' },
        method: 'pipelines.getPipeline',
        params: { name: 'digest' },
        tool: 'pipelines_get_pipeline'
      },
      {
        args: { document: 'apiVersion: agentg.dev/v1\nkind: Pipeline\n' },
        method: 'pipelines.setPipeline',
        params: { document: 'apiVersion: agentg.dev/v1\nkind: Pipeline\n' },
        tool: 'pipelines_set_pipeline'
      },
      {
        args: { idempotencyKey: 'manual-1', name: 'digest' },
        method: 'pipelines.runPipeline',
        params: { idempotencyKey: 'manual-1', name: 'digest' },
        tool: 'pipelines_run_pipeline'
      },
      {
        args: { runId: 'run-1' },
        method: 'pipelines.getRun',
        params: { runId: 'run-1' },
        tool: 'pipelines_get_run'
      },
      {
        args: { pipelineName: 'digest', status: 'completed' },
        method: 'pipelines.listRuns',
        params: { pipelineName: 'digest', status: 'completed' },
        tool: 'pipelines_list_runs'
      },
      {
        args: { name: 'digest' },
        method: 'pipelines.deletePipeline',
        params: { name: 'digest' },
        tool: 'pipelines_delete_pipeline'
      }
    ];

    for (const item of cases) {
      await callTool(item.tool, item.args, bridge);
    }

    expect(calls).toEqual(
      cases.map((item) =>
        item.params === undefined
          ? { method: item.method }
          : { method: item.method, params: item.params }
      )
    );
  });

  it('requires Data annotation subject before calling Gateway', async () => {
    const { bridge, calls } = createBridge();

    await expect(callTool('data_list_annotations', { key: 'summary' }, bridge)).rejects.toThrow(
      'subject is required'
    );
    expect(calls).toEqual([]);
  });

  it('keeps Data collection item write modes aligned with Data schema', async () => {
    const { bridge, calls } = createBridge();
    const subject = { _model: 'telegram.chat', id: 'chat-1' };

    await expect(
      callTool(
        'data_write_collection_item',
        { itemId: 'pricing', key: 'subjects', mode: 'append', subject, value: {} },
        bridge
      )
    ).rejects.toThrow('append mode does not accept itemId');
    await expect(
      callTool(
        'data_write_collection_item',
        { key: 'subjects', mode: 'merge', subject, value: {} },
        bridge
      )
    ).rejects.toThrow('itemId is required');

    expect(calls).toEqual([]);
  });
});
