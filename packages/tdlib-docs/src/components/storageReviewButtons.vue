<script setup lang="ts">
import { computed, ref } from 'vue';

import { storageReviewButtons, type StorageReviewButton } from '../storageReviewDisplay.js';
import type { StorageReviewEntry } from '../storageReviewTypes.js';
import StorageReviewInfoCard from './storageReviewInfoCard.vue';

const props = defineProps<{
  entry: StorageReviewEntry;
  maxNoteCount: number;
}>();

const emit = defineEmits<{
  toggle: [reviewIndex: number];
}>();

const reviewButtons = computed(() => storageReviewButtons(props.entry));
const reviewPopover = ref<{
  entry: StorageReviewEntry;
  reviewIndex: number;
  left: number;
  top: number;
} | null>(null);

function reviewButtonAriaLabel(reviewButton: StorageReviewButton): string {
  const maturityLabel =
    reviewButton.maturity === null ? 'unknown maturity' : `maturity ${reviewButton.label}`;
  return `Show ${maturityLabel} review for ${props.entry.type}`;
}

function reviewButtonStyle(
  reviewButton: StorageReviewButton
): { '--storage-review-note-fill': string } | undefined {
  if (reviewButton.noteCount === 0 || props.maxNoteCount === 0) {
    return undefined;
  }

  const fillPercent = (reviewButton.noteCount / props.maxNoteCount) * 100;
  return { '--storage-review-note-fill': `${String(fillPercent)}%` };
}

function showReviewPopover(reviewIndex: number, event: MouseEvent): void {
  if (reviewButtons.value.length === 0) {
    return;
  }

  const popoverWidth = 700;
  const popoverHeight = 560;
  reviewPopover.value = {
    entry: props.entry,
    reviewIndex,
    left: Math.max(8, Math.min(event.clientX + 14, window.innerWidth - popoverWidth)),
    top: Math.max(8, Math.min(event.clientY + 14, window.innerHeight - popoverHeight))
  };
}

function hideReviewPopover(): void {
  reviewPopover.value = null;
}
</script>

<template>
  <div v-if="reviewButtons.length > 0" class="storage-review-buttons">
    <button
      v-for="reviewButton in reviewButtons"
      :key="reviewButton.key"
      :aria-label="reviewButtonAriaLabel(reviewButton)"
      :data-alert="reviewButton.hasAlert ? 'true' : undefined"
      :data-notes="reviewButton.hasNotes ? 'true' : undefined"
      :style="reviewButtonStyle(reviewButton)"
      class="storage-review-buttons__button"
      type="button"
      @click.stop="emit('toggle', reviewButton.index)"
      @mouseenter="showReviewPopover(reviewButton.index, $event)"
      @mouseleave="hideReviewPopover"
      @mousemove="showReviewPopover(reviewButton.index, $event)"
    >
      <span v-if="reviewButton.hasNotes" class="storage-review-buttons__notes-fill"></span>
      <span class="storage-review-buttons__value">
        {{ reviewButton.label }}
      </span>
    </button>
  </div>
  <Teleport to="body">
    <div
      v-if="reviewPopover !== null"
      :style="{ left: `${reviewPopover.left}px`, top: `${reviewPopover.top}px` }"
      class="storage-review-buttons__popover"
    >
      <StorageReviewInfoCard
        :compact="true"
        :entry="reviewPopover.entry"
        :review-index="reviewPopover.reviewIndex"
      />
    </div>
  </Teleport>
</template>

<style scoped>
@reference '../style.css';

.storage-review-buttons {
  @apply flex shrink-0 items-center gap-1;
}

.storage-review-buttons__button {
  @apply relative flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-hidden rounded border border-transparent bg-transparent p-0 font-mono text-[11px] font-semibold leading-none text-sky-800 hover:border-sky-500 hover:text-sky-950;
}

.storage-review-buttons__button[data-notes='true'] {
  @apply border-neutral-300 text-neutral-800 hover:border-neutral-500 hover:text-neutral-950;
}

.storage-review-buttons__button[data-alert='true'] {
  @apply border-red-500 bg-red-50 text-red-700 hover:border-red-600 hover:text-red-900;
}

.storage-review-buttons__notes-fill {
  @apply pointer-events-none absolute inset-x-0 bottom-0 h-[var(--storage-review-note-fill)] bg-neutral-200;
}

.storage-review-buttons__value {
  @apply relative;
}

.storage-review-buttons__popover {
  @apply fixed z-50;
}
</style>
