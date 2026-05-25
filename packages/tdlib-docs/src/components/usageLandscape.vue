<script setup lang="ts">
import { computed } from 'vue';

import { resolveEntityId } from '../schemaIndex.js';
import type { TdlibTypeUsageLandscape, TdlibUsageGroup, TdlibUsageItem } from '../types.js';
import EntityLink from './entityLink.vue';

const props = defineProps<{
  landscape: TdlibTypeUsageLandscape;
  parentInstanceId: string;
}>();

defineSlots<{
  'inline-card'(props: { slotKey: string }): unknown;
}>();

type UsageSection = {
  group: TdlibUsageGroup;
  key: string;
  title: string;
};

const sections = computed<UsageSection[]>(() => [
  { group: props.landscape.updates, key: 'updates', title: 'Used by updates' },
  { group: props.landscape.types, key: 'types', title: 'Used by types' },
  { group: props.landscape.functions, key: 'functions', title: 'Used by procedures' }
]);

function itemSlot(group: TdlibUsageGroup, bucket: string, item: TdlibUsageItem): string {
  return `usage:${group.kind}:${bucket}:${item.name}`;
}

function viaSlot(item: TdlibUsageItem, typeName: string): string {
  return `usage-via:${item.entityId}:${typeName}`;
}
</script>

<template>
  <section class="usage-landscape">
    <section v-for="section in sections" :key="section.key" class="usage-landscape__group">
      <h4 class="usage-landscape__group-title">{{ section.title }}</h4>

      <div class="usage-landscape__bucket">
        <span class="usage-landscape__bucket-title">Direct</span>
        <div class="usage-landscape__list">
          <span v-if="section.group.direct.length === 0" class="usage-landscape__empty">none</span>
          <div
            v-for="item in section.group.direct"
            :key="item.entityId"
            class="usage-landscape__item"
          >
            <div class="usage-landscape__item-row">
              <EntityLink
                :entity-id="item.entityId"
                :parent-instance-id="parentInstanceId"
                :slot-key="itemSlot(section.group, 'direct', item)"
                :text="item.name"
              />
            </div>
            <slot name="inline-card" :slot-key="itemSlot(section.group, 'direct', item)"></slot>
          </div>
        </div>
      </div>

      <div class="usage-landscape__bucket">
        <span class="usage-landscape__bucket-title">Indirect</span>
        <div class="usage-landscape__list">
          <span v-if="section.group.indirect.length === 0" class="usage-landscape__empty"
            >none</span
          >
          <div
            v-for="item in section.group.indirect"
            :key="item.entityId"
            class="usage-landscape__item"
          >
            <div class="usage-landscape__item-row">
              <EntityLink
                :entity-id="item.entityId"
                :parent-instance-id="parentInstanceId"
                :slot-key="itemSlot(section.group, 'indirect', item)"
                :text="item.name"
              />
              <span v-if="item.viaTypes.length > 0" class="usage-landscape__via">
                via
                <EntityLink
                  v-for="typeName in item.viaTypes"
                  :key="typeName"
                  :entity-id="resolveEntityId(typeName)"
                  :parent-instance-id="parentInstanceId"
                  :slot-key="viaSlot(item, typeName)"
                  :text="typeName"
                />
              </span>
            </div>
            <slot name="inline-card" :slot-key="itemSlot(section.group, 'indirect', item)"></slot>
            <slot
              v-for="typeName in item.viaTypes"
              :key="typeName"
              name="inline-card"
              :slot-key="viaSlot(item, typeName)"
            ></slot>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
@reference '../style.css';

.usage-landscape {
  @apply mt-2 flex flex-col gap-1.5;
}

.usage-landscape__group {
  @apply min-w-0;
}

.usage-landscape__group-title {
  @apply m-0 mb-1.5 text-sm font-semibold leading-tight text-neutral-900;
}

.usage-landscape__bucket {
  @apply mb-1 grid grid-cols-[64px_minmax(0,1fr)] gap-1.5 last:mb-0;
}

.usage-landscape__bucket-title {
  @apply pt-0.5 text-[11px] uppercase leading-none text-neutral-500;
}

.usage-landscape__list {
  @apply flex min-w-0 flex-col gap-1;
}

.usage-landscape__item {
  @apply flex max-w-full flex-col gap-1;
}

.usage-landscape__item-row {
  @apply flex max-w-full flex-wrap items-center gap-1;
}

.usage-landscape__empty {
  @apply text-xs text-neutral-400;
}

.usage-landscape__via {
  @apply inline-flex max-w-full flex-wrap items-center gap-1 text-xs text-neutral-500;
}

@media (max-width: 900px) {
  .usage-landscape__bucket {
    @apply grid-cols-1;
  }
}
</style>
