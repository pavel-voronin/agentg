import { toJsonValue } from '@agentg/framework';
import { parseDocument } from 'yaml';

import { documentSchema, type Document } from './schema.js';

const supportedActions = new Set([
  'data.select',
  'data.get',
  'data.expand',
  'data.render',
  'data.writeAnnotation',
  'data.writeCollectionItem',
  'llm.run'
]);

export function parseDefinition(input: string | Document): {
  document: Document;
  yaml: string;
} {
  if (typeof input !== 'string') {
    const document = documentSchema.parse(input);
    validateDefinition(document);
    return {
      document,
      yaml: JSON.stringify(toJsonValue(document), null, 2)
    };
  }
  const parsed = parseDocument(input);
  if (parsed.errors.length > 0) {
    throw new Error(`Pipeline YAML is invalid: ${parsed.errors[0]?.message ?? 'parse failed'}`);
  }
  if (parsed.warnings.length > 0) {
    throw new Error(`Pipeline YAML is invalid: ${parsed.warnings[0]?.message ?? 'parse warning'}`);
  }
  const document = documentSchema.parse(parsed.toJSON());
  validateDefinition(document);
  return {
    document,
    yaml: input
  };
}

export function executionOrder(document: Document): string[] {
  const names = Object.keys(document.spec.nodes);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const output: string[] = [];

  for (const name of names) {
    visit(name);
  }
  return output;

  function visit(name: string): void {
    if (visited.has(name)) {
      return;
    }
    if (visiting.has(name)) {
      throw new Error(`Pipeline node graph has a cycle at ${name}`);
    }
    const node = document.spec.nodes[name];
    if (node === undefined) {
      throw new Error(`Pipeline node is missing: ${name}`);
    }
    visiting.add(name);
    for (const dependency of dependencies(node)) {
      visit(dependency);
    }
    visiting.delete(name);
    visited.add(name);
    output.push(name);
  }
}

export function dependencies(node: {
  from?: string | undefined;
  needs?: readonly string[] | undefined;
}): string[] {
  return [...(node.from === undefined ? [] : [node.from]), ...(node.needs ?? [])];
}

function validateDefinition(document: Document): void {
  const nodes = document.spec.nodes;
  const names = Object.keys(nodes);
  if (names.length === 0) {
    throw new Error('Pipeline spec.nodes must not be empty');
  }
  for (const [name, node] of Object.entries(nodes)) {
    if (!supportedActions.has(node.use)) {
      throw new Error(`Pipeline node ${name} uses unknown action id: ${node.use}`);
    }
    for (const dependency of dependencies(node)) {
      if (dependency === name) {
        throw new Error(`Pipeline node ${name} cannot reference itself`);
      }
      if (nodes[dependency] === undefined) {
        throw new Error(`Pipeline node ${name} references missing node: ${dependency}`);
      }
    }
  }
  executionOrder(document);
}
