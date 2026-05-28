export type StorageReviewStatus = 'blocked' | 'done';
export type StorageReviewMaturity = 1 | 2 | 3;
export type StorageReviewSchema = 'storage-decision';
export type StorageSchemaColumnLayout = 'ddl' | 'grid' | 'stacked';

export type StorageReviewConstructor = {
  fields: string[];
  name: string;
};

export type StorageReviewUses = {
  directTypeUse: string[];
  directUpdateUse: string[];
  indirectTypeUse: string[];
  indirectUpdateUse: string[];
  procedureUse: string[];
};

export type StorageDecisionReview = {
  constructors: StorageReviewConstructor[];
  decision: string;
  maturity: StorageReviewMaturity;
  notes: string[];
  openQuestions: string[];
  rejectedStorage: Record<string, string>;
  schema: 'storage-decision';
  status: StorageReviewStatus;
  uses: StorageReviewUses;
};

export type StorageReview = StorageDecisionReview;

export type StorageReviewIssue = {
  index: number;
  issues: string[];
  maturity?: StorageReviewMaturity;
  schema?: string;
};

export type StorageReviewEntry = {
  maturity: StorageReviewMaturity;
  reviewIssues: StorageReviewIssue[];
  reviews: unknown[];
  schemaDesign?: StorageTypeSchemaDesign;
  storage: string;
  storageTarget: string;
  type: string;
};

export type StorageSchemaFieldTarget =
  | {
      kind: 'constructor-payload';
    }
  | {
      kind: 'embedded-payload';
    }
  | {
      kind: 'dynamic';
      ruleId: string;
    }
  | {
      column: string;
      kind: 'embedded';
      path?: string;
      table: string;
    }
  | {
      event: string;
      kind: 'event-payload';
    }
  | {
      kind: 'not-stored';
      reason: string;
    }
  | {
      kind: 'pending';
    }
  | {
      fieldId: string;
      kind: 'table-column';
    }
  | {
      fieldId: string;
      kind: 'table-ref';
      referencedTable?: string;
    };

export type StorageSchemaFieldDesign = {
  name: string;
  notes: string[];
  target: StorageSchemaFieldTarget;
  tdlibType: string;
};

export type StorageSchemaConstructorDesign = {
  fields: StorageSchemaFieldDesign[];
  name: string;
  notes: string[];
  target?: StorageSchemaConstructorTarget;
};

export type StorageSchemaConstructorTarget =
  | {
      event: string;
      kind: 'event';
    }
  | {
      key: string;
      keySourceFields?: string[];
      kind: 'kv';
      sourceFields?: string[];
      table: string;
      valueColumn: string;
    };

export type StorageTypeSchemaDesign = {
  constructors: StorageSchemaConstructorDesign[];
  notes: string[];
};

export type StorageSchemaTableColumn = {
  id: string;
  keyRule?: StorageSchemaColumnKeyRule;
  name: string;
  notes: string[];
  nullable: boolean;
  pgType: string;
  role: 'data' | 'foreign-key' | 'primary-key';
  sourceFields: string[];
};

export type StorageSchemaColumnKeyRule = {
  cases: Record<string, string>;
  kind: 'constructor-discriminator';
  type: string;
};

export type StorageSchemaForeignKey = {
  columns: string[];
  id: string;
  notes: string[];
  onDelete?: StorageSchemaForeignKeyAction;
  referencedColumns: string[];
  referencedTable: string;
  sourceFields: string[];
};

export type StorageSchemaForeignKeyAction =
  | 'cascade'
  | 'no action'
  | 'restrict'
  | 'set default'
  | 'set null';

export type StorageSchemaTable = {
  columnLayout?: StorageSchemaColumnLayout;
  columns: StorageSchemaTableColumn[];
  foreignKeys: StorageSchemaForeignKey[];
  indexes: unknown[];
  indirectSourceTypes: string[];
  name: string;
  notes: string[];
  primaryKey: string[];
  sourceTypes: string[];
};

export type StorageSchemaUpdateEffectKind =
  | 'cache-invalidation'
  | 'file-download'
  | 'file-system'
  | 'other';

export type StorageSchemaUpdateEventRoute = {
  name: string;
  notes: string[];
  sourceFields: string[];
};

export type StorageSchemaUpdateEffectRoute = {
  kind: StorageSchemaUpdateEffectKind;
  name: string;
  notes: string[];
  sourceFields: string[];
};

export type StorageSchemaUpdateIgnoredRoute = {
  reason: string;
};

export type StorageSchemaUpdateHandlerPlanStatus = 'draft' | 'ready';

export type StorageSchemaUpdateHandlerPlanStepOp =
  | 'delegateType'
  | 'deleteRows'
  | 'ignoreField'
  | 'publishEvent'
  | 'replaceRows'
  | 'replaceTable'
  | 'returnWhen'
  | 'runEffect'
  | 'upsertTable';

export type StorageSchemaUpdateHandlerPlanStep = {
  columns?: string[];
  condition?: string;
  description: string;
  effect?: string;
  effectKind?: StorageSchemaUpdateEffectKind;
  event?: string;
  id: string;
  op: StorageSchemaUpdateHandlerPlanStepOp;
  sourceFields: string[];
  table?: string;
  type?: string;
};

export type StorageSchemaUpdateHandlerPlan = {
  maturity: StorageReviewMaturity;
  notes: string[];
  status: StorageSchemaUpdateHandlerPlanStatus;
  steps: StorageSchemaUpdateHandlerPlanStep[];
  summary: string;
};

export type StorageSchemaUpdateFieldDesign = {
  effects?: StorageSchemaUpdateEffectRoute[];
  events?: StorageSchemaUpdateEventRoute[];
  ignored?: StorageSchemaUpdateIgnoredRoute;
  notes?: string[];
};

export type StorageSchemaUpdateDesign = {
  fields: Record<string, StorageSchemaUpdateFieldDesign>;
  handlerPlan?: StorageSchemaUpdateHandlerPlan;
  notes: string[];
};

export type StorageSchemaTablePatch = {
  columnLayout?: StorageSchemaColumnLayout;
};

export type StorageReviewState = {
  entries: StorageReviewEntry[];
  storageOptions: string[];
  tables?: StorageSchemaTable[];
  updateDesigns?: Record<string, StorageSchemaUpdateDesign>;
  version: 1 | 2;
};

export type StorageReviewEntryPatch = {
  maturity?: StorageReviewMaturity;
  reviews?: unknown[];
  storage?: string;
  storageTarget?: string;
};
