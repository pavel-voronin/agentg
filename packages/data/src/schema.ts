import type { JsonValue } from '@agentg/framework';
import { z } from 'zod';

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number(),
    z.boolean(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

const modelRefSchema = z
  .object({
    _model: z.string().trim().min(1),
    id: z.string().trim().min(1)
  })
  .strict();

const datasetRowSchema = z
  .object({
    lineage: z.array(modelRefSchema).readonly(),
    refs: z.record(z.string().trim().min(1), modelRefSchema),
    value: jsonValueSchema
  })
  .strict();

const sortInputSchema = z
  .object({
    direction: z.enum(['asc', 'desc']),
    key: z.string().trim().min(1)
  })
  .strict();

const textQuerySchema = z.string().trim().min(1);

const dateTimeQuerySchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date/time');

const annotationBrowseWhereSchema = z
  .object({
    subjectNotQuery: textQuerySchema.optional(),
    subjectQuery: textQuerySchema.optional(),
    updatedAtGt: dateTimeQuerySchema.optional(),
    updatedAtGte: dateTimeQuerySchema.optional(),
    updatedAtLt: dateTimeQuerySchema.optional(),
    updatedAtLte: dateTimeQuerySchema.optional(),
    valueNotQuery: textQuerySchema.optional(),
    valueQuery: textQuerySchema.optional()
  })
  .strict();

const collectionBrowseWhereSchema = annotationBrowseWhereSchema
  .extend({
    itemIdNotQuery: textQuerySchema.optional(),
    itemIdQuery: textQuerySchema.optional()
  })
  .strict();

export const datasetSchema = z
  .object({
    rows: z.array(datasetRowSchema).readonly()
  })
  .strict();

export type ProviderCapability = 'expand' | 'get' | 'render' | 'select';

export const selectInputSchema = z
  .object({
    limit: z.number().int().positive().optional(),
    model: z.string().trim().min(1),
    offset: z.number().int().nonnegative().optional(),
    sort: sortInputSchema.optional(),
    where: jsonValueSchema.optional()
  })
  .strict();

export const getInputSchema = z
  .object({
    ref: modelRefSchema
  })
  .strict();

export const expandInputSchema = z
  .object({
    from: z.array(datasetRowSchema).readonly(),
    limit: z.number().int().positive().optional(),
    relation: z.string().trim().min(1),
    sourceRef: z.string().trim().min(1),
    where: jsonValueSchema.optional()
  })
  .strict();

export const renderInputSchema = z
  .object({
    format: z.enum(['json', 'text']),
    from: z.array(datasetRowSchema).readonly(),
    options: jsonValueSchema.optional(),
    sourceRef: z.string().trim().min(1)
  })
  .strict();

export const writeAnnotationInputSchema = z
  .object({
    key: z.string().trim().min(1),
    lineage: z.array(modelRefSchema).readonly().optional(),
    mode: z.enum(['replace', 'merge']),
    subject: modelRefSchema,
    value: jsonValueSchema
  })
  .strict();

export const writeCollectionItemInputSchema = z.discriminatedUnion('mode', [
  z
    .object({
      itemId: z.never().optional(),
      key: z.string().trim().min(1),
      lineage: z.array(modelRefSchema).readonly().optional(),
      mode: z.literal('append'),
      subject: modelRefSchema,
      value: jsonValueSchema
    })
    .strict(),
  z
    .object({
      itemId: z.string().trim().min(1),
      key: z.string().trim().min(1),
      lineage: z.array(modelRefSchema).readonly().optional(),
      mode: z.literal('replace'),
      subject: modelRefSchema,
      value: jsonValueSchema
    })
    .strict(),
  z
    .object({
      itemId: z.string().trim().min(1),
      key: z.string().trim().min(1),
      lineage: z.array(modelRefSchema).readonly().optional(),
      mode: z.literal('merge'),
      subject: modelRefSchema,
      value: jsonValueSchema
    })
    .strict()
]);

export const annotationAddressSchema = z
  .object({
    key: z.string().trim().min(1),
    subject: modelRefSchema
  })
  .strict();

export const collectionItemAddressSchema = z
  .object({
    itemId: z.string().trim().min(1),
    key: z.string().trim().min(1),
    subject: modelRefSchema
  })
  .strict();

export const listAnnotationsInputSchema = z
  .object({
    key: z.string().trim().min(1).optional(),
    subject: modelRefSchema
  })
  .strict();

export const listCollectionInputSchema = z
  .object({
    key: z.string().trim().min(1),
    subject: modelRefSchema
  })
  .strict();

export const browseAnnotationsInputSchema = z
  .object({
    key: z.string().trim().min(1).optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    sort: sortInputSchema.optional(),
    subject: modelRefSchema.optional(),
    subjectModel: z.string().trim().min(1).optional(),
    where: annotationBrowseWhereSchema.optional()
  })
  .strict();

export const browseCollectionInputSchema = z
  .object({
    key: z.string().trim().min(1).optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    sort: sortInputSchema.optional(),
    subject: modelRefSchema.optional(),
    subjectModel: z.string().trim().min(1).optional(),
    where: collectionBrowseWhereSchema.optional()
  })
  .strict();

const rowRefSelectorSchema = z
  .object({
    ref: z.string().trim().min(1)
  })
  .strict();

const rowFieldSelectorSchema = z
  .object({
    field: z.string().trim().min(1)
  })
  .strict();

const rowRefIdSelectorSchema = z
  .object({
    refId: z.string().trim().min(1)
  })
  .strict();

export const writeAnnotationActionInputSchema = z
  .object({
    key: z.string().trim().min(1),
    mode: z.enum(['replace', 'merge']),
    subject: rowRefSelectorSchema,
    value: jsonValueSchema.optional(),
    valueFrom: rowFieldSelectorSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.value !== undefined && value.valueFrom !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'value and valueFrom cannot both be set',
        path: ['valueFrom']
      });
    }
  });

export const writeCollectionItemActionInputSchema = z
  .object({
    itemId: z.string().trim().min(1).optional(),
    itemIdFrom: z.union([rowFieldSelectorSchema, rowRefIdSelectorSchema]).optional(),
    key: z.string().trim().min(1),
    mode: z.enum(['append', 'replace', 'merge']),
    subject: rowRefSelectorSchema,
    value: jsonValueSchema.optional(),
    valueFrom: rowFieldSelectorSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.itemId !== undefined && value.itemIdFrom !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'itemId and itemIdFrom cannot both be set',
        path: ['itemIdFrom']
      });
    }
    if (value.value !== undefined && value.valueFrom !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'value and valueFrom cannot both be set',
        path: ['valueFrom']
      });
    }
    if (value.mode === 'append' && (value.itemId !== undefined || value.itemIdFrom !== undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'append mode does not accept itemId or itemIdFrom',
        path: ['itemId']
      });
    }
    if (value.mode !== 'append' && value.itemId === undefined && value.itemIdFrom === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'replace and merge modes require itemId or itemIdFrom',
        path: ['itemId']
      });
    }
  });

export const actionRequestSchema = z
  .object({
    input: datasetSchema,
    node: z
      .object({
        id: z.string().trim().min(1),
        runId: z.string().trim().min(1)
      })
      .strict(),
    with: jsonValueSchema.optional()
  })
  .strict();

export const actionResultSchema = z.union([
  z
    .object({
      dataset: datasetSchema,
      status: z.literal('ready')
    })
    .strict(),
  z
    .object({
      error: z
        .object({
          code: z.string().trim().min(1),
          message: z.string()
        })
        .strict(),
      status: z.literal('rejected')
    })
    .strict()
]);

export type ModelRef = z.infer<typeof modelRefSchema>;
export type DatasetRow = z.infer<typeof datasetRowSchema>;
export type Dataset = z.infer<typeof datasetSchema>;
export type SelectInput = z.infer<typeof selectInputSchema>;
export type GetInput = z.infer<typeof getInputSchema>;
export type ExpandInput = z.infer<typeof expandInputSchema>;
export type BrowseAnnotationsInput = z.infer<typeof browseAnnotationsInputSchema>;
export type BrowseCollectionInput = z.infer<typeof browseCollectionInputSchema>;
export type RenderInput = z.infer<typeof renderInputSchema>;
export type WriteAnnotationInput = z.infer<typeof writeAnnotationInputSchema>;
export type WriteCollectionItemInput = z.infer<typeof writeCollectionItemInputSchema>;
export type ActionResult = z.infer<typeof actionResultSchema>;
