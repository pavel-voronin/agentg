<script setup lang="ts">
import type {
  SchemaDesignFieldLayout,
  SchemaDesignSourceFocusRequest,
  SchemaDesignTableFocusRequest,
  SchemaDesignUpdateFocusTarget
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaTable,
  StorageSchemaUpdateDesign
} from '../../storageReviewTypes.js';
import type { TdlibCallableEntity } from '../../types.js';
import SchemaDesignUpdateProcessCard from './schemaDesignUpdateProcessCard.vue';

defineProps<{
  entries: StorageReviewEntry[];
  fieldLayout: SchemaDesignFieldLayout;
  focusTarget: SchemaDesignUpdateFocusTarget | null;
  tables: StorageSchemaTable[];
  update: TdlibCallableEntity;
  updateDesign: StorageSchemaUpdateDesign | undefined;
  updateName: string;
}>();

const emit = defineEmits<{
  fieldLayoutChange: [fieldLayout: SchemaDesignFieldLayout];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  tableFocus: [target: SchemaDesignTableFocusRequest];
}>();
</script>

<template>
  <tr :data-schema-update="updateName" class="schema-design-update-expanded-row">
    <td class="schema-design-update-expanded-row__cell" colspan="1">
      <div class="schema-design-update-expanded-row__content">
        <SchemaDesignUpdateProcessCard
          :entries="entries"
          :field-layout="fieldLayout"
          :focus-target="focusTarget"
          :tables="tables"
          :update="update"
          :update-design="updateDesign"
          @field-layout-change="emit('fieldLayoutChange', $event)"
          @source-focus="emit('sourceFocus', $event)"
          @table-focus="emit('tableFocus', $event)"
        />
      </div>
    </td>
  </tr>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-update-expanded-row {
  @apply align-top;
}

.schema-design-update-expanded-row__cell {
  @apply border-b border-neutral-200 bg-neutral-50 px-2 py-2;
}

.schema-design-update-expanded-row__content {
  @apply flex max-w-5xl flex-col gap-2;
}
</style>
