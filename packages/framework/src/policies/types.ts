import type { JsonValue } from '../json.js';

export const POLICY_API_VERSION = 'agentg.dev/v1';
export const POLICY_INSTANCES_CHANGED_EVENT = 'policies.instances.changed';

export type PolicyIdentity = {
  kind: string;
  name: string;
};

export type PolicyMetadata = {
  labels?: Record<string, string>;
  name: string;
};

export type PolicyDocument = {
  apiVersion: typeof POLICY_API_VERSION;
  kind: string;
  metadata: PolicyMetadata;
  spec: JsonValue;
};

export type PolicyValue = readonly JsonValue[] | Readonly<Record<string, JsonValue>>;

export type PolicyKindDescriptor = {
  form: {
    examples?: readonly PolicyDocument[];
    spec: JsonValue;
  };
  id: string;
  kind: string;
  moduleId: string;
  version: number;
};

export type PolicyErrorCode =
  | 'unknown_kind'
  | 'invalid_api_version'
  | 'invalid_document'
  | 'invalid_spec'
  | 'resolver_error'
  | 'non_json_value'
  | 'duplicate_identity'
  | 'path_identity_mismatch'
  | 'store_conflict';

export type PolicyError = {
  code: PolicyErrorCode;
  fieldPath?: readonly string[];
  identity?: PolicyIdentity;
  message: string;
};

export type PolicyMutationResult =
  | {
      identity: PolicyIdentity;
      operation: 'delete' | 'set';
      policyValueChanged: boolean;
      status: 'applied';
    }
  | {
      error: PolicyError;
      identity?: PolicyIdentity;
      operation: 'delete' | 'set';
      policyValueChanged: false;
      status: 'rejected';
    };

export type PolicyInstancesChanged = {
  kind: string;
  moduleId: string;
};

export type PolicyStore = {
  delete(identity: PolicyIdentity): Promise<void>;
  loadAll(): Promise<readonly PolicyDocument[]>;
  set(document: PolicyDocument): Promise<void>;
};

export type PolicyProcedures = {
  deleteInstance(input: PolicyIdentity): PolicyMutationResult | Promise<PolicyMutationResult>;
  getInstance(input: PolicyIdentity): PolicyDocument | Promise<PolicyDocument>;
  getPolicyValue(input: { kind: string }): PolicyValue | Promise<PolicyValue>;
  listInstances(input?: {
    kind?: string;
    labels?: Record<string, string>;
    moduleId?: string;
  }): readonly PolicyDocument[] | Promise<readonly PolicyDocument[]>;
  listPolicyKinds(): readonly PolicyKindDescriptor[] | Promise<readonly PolicyKindDescriptor[]>;
  setInstance(input: {
    document: PolicyDocument;
  }): PolicyMutationResult | Promise<PolicyMutationResult>;
};
