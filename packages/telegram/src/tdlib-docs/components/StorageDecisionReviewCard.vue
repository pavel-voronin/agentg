<script setup lang="ts">
import { computed } from 'vue';

import type { StorageDecisionReview, StorageReviewEntry } from '../storageReviewTypes.js';

const props = defineProps<{
  compact: boolean;
  entry: StorageReviewEntry;
  issues: string[];
  rawReviewText: string;
  review: StorageDecisionReview | null;
  showCloseButton: boolean;
}>();
const emit = defineEmits<{
  close: [];
}>();

const rejectedStorageEntries = computed(() => Object.entries(props.review?.rejectedStorage ?? {}));
const cardState = computed(() => {
  if (props.issues.length > 0 || props.review?.status === 'blocked') {
    return 'error';
  }
  if (props.review?.maturity !== props.entry.maturity) {
    return 'stale';
  }

  return 'ready';
});
</script>

<template>
  <article
    :data-compact="compact ? 'true' : undefined"
    :data-state="cardState"
    class="storage-decision-review-card"
  >
    <header class="storage-decision-review-card__header">
      <div class="storage-decision-review-card__heading">
        <span class="storage-decision-review-card__eyebrow">
          {{ issues.length > 0 ? 'Storage decision form issue' : 'Storage decision' }}
        </span>
        <h3 class="storage-decision-review-card__title">{{ entry.type }}</h3>
      </div>
      <div class="storage-decision-review-card__controls">
        <div v-if="review !== null" class="storage-decision-review-card__badges">
          <span class="storage-decision-review-card__status">{{ review.status }}</span>
          <span class="storage-decision-review-card__maturity">
            maturity {{ review.maturity }}
          </span>
        </div>
        <button
          v-if="showCloseButton"
          :aria-label="`Close review for ${entry.type}`"
          class="storage-decision-review-card__close"
          title="Close review"
          type="button"
          @click.stop="emit('close')"
        >
          ×
        </button>
      </div>
    </header>

    <section v-if="issues.length > 0" class="storage-decision-review-card__section">
      <ul class="storage-decision-review-card__issue-list">
        <li v-for="issue in issues" :key="issue" class="storage-decision-review-card__issue">
          {{ issue }}
        </li>
      </ul>
      <pre v-if="rawReviewText.length > 0" class="storage-decision-review-card__raw">{{
        rawReviewText
      }}</pre>
    </section>

    <template v-else-if="review !== null">
      <p class="storage-decision-review-card__decision">{{ review.decision }}</p>

      <section class="storage-decision-review-card__section">
        <h4 class="storage-decision-review-card__section-title">Selected Storage</h4>
        <div class="storage-decision-review-card__list">
          <div class="storage-decision-review-card__item">
            <span class="storage-decision-review-card__code">{{ entry.storage || 'unset' }}</span>
            <span v-if="entry.storageTarget.length > 0" class="storage-decision-review-card__muted">
              {{ entry.storageTarget }}
            </span>
          </div>
        </div>
      </section>

      <section class="storage-decision-review-card__section">
        <h4 class="storage-decision-review-card__section-title">Rejected Storage</h4>
        <div class="storage-decision-review-card__list">
          <div
            v-for="[storage, reason] in rejectedStorageEntries"
            :key="storage"
            class="storage-decision-review-card__item"
          >
            <span class="storage-decision-review-card__code">{{ storage }}</span>
            <span class="storage-decision-review-card__muted">{{ reason }}</span>
          </div>
        </div>
      </section>

      <section v-if="review.notes.length > 0" class="storage-decision-review-card__section">
        <h4 class="storage-decision-review-card__section-title">Notes</h4>
        <ul class="storage-decision-review-card__list">
          <li
            v-for="(note, noteIndex) in review.notes"
            :key="`${String(noteIndex)}:${note}`"
            class="storage-decision-review-card__note"
          >
            {{ note }}
          </li>
        </ul>
      </section>

      <section v-if="review.openQuestions.length > 0" class="storage-decision-review-card__section">
        <h4 class="storage-decision-review-card__section-title">Open Questions</h4>
        <ul class="storage-decision-review-card__list">
          <li
            v-for="question in review.openQuestions"
            :key="question"
            class="storage-decision-review-card__item"
          >
            {{ question }}
          </li>
        </ul>
      </section>
    </template>
  </article>
</template>

<style scoped>
@reference '../style.css';

.storage-decision-review-card {
  @apply rounded border border-l-4 border-l-sky-500 border-neutral-200 bg-white p-3 text-neutral-950;
}

.storage-decision-review-card[data-state='error'] {
  @apply border-l-red-500;
}

.storage-decision-review-card[data-state='stale'] {
  @apply border-l-neutral-300;
}

.storage-decision-review-card[data-compact='true'] {
  @apply max-h-[560px] w-[680px] overflow-auto p-2 shadow-lg;
}

.storage-decision-review-card__header {
  @apply flex items-start justify-between gap-3;
}

.storage-decision-review-card__heading {
  @apply min-w-0;
}

.storage-decision-review-card__controls {
  @apply flex shrink-0 items-center gap-2;
}

.storage-decision-review-card__eyebrow {
  @apply text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.storage-decision-review-card__title {
  @apply m-0 mt-1 break-words font-mono text-base font-semibold leading-tight text-neutral-950;
}

.storage-decision-review-card__badges {
  @apply flex shrink-0 flex-wrap items-center justify-end gap-2;
}

.storage-decision-review-card__close {
  @apply box-border flex h-7 w-7 items-center justify-center rounded border border-neutral-300 bg-white text-sm leading-none text-neutral-600 hover:border-neutral-500 hover:text-neutral-950;
}

.storage-decision-review-card__status {
  @apply box-border flex h-7 items-center justify-center rounded border border-neutral-200 px-2 text-[11px] font-semibold uppercase leading-none text-neutral-600;
}

.storage-decision-review-card__maturity {
  @apply box-border flex h-7 items-center justify-center rounded border border-sky-200 px-2 font-mono text-[11px] font-semibold leading-none text-sky-800;
}

.storage-decision-review-card__decision {
  @apply my-2 text-sm leading-snug text-neutral-800;
}

.storage-decision-review-card__section {
  @apply mt-2;
}

.storage-decision-review-card__section-title {
  @apply mb-1 text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.storage-decision-review-card__list {
  @apply m-0 flex flex-col gap-1 p-0;
}

.storage-decision-review-card__item {
  @apply flex min-w-0 flex-wrap gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs leading-snug text-neutral-800;
}

.storage-decision-review-card__note {
  @apply flex min-w-0 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs leading-snug text-amber-900;
}

.storage-decision-review-card__code {
  @apply shrink-0 font-mono text-sky-800;
}

.storage-decision-review-card__muted {
  @apply min-w-0 break-words text-neutral-700;
}

.storage-decision-review-card__issue-list {
  @apply m-0 flex flex-col gap-1 p-0;
}

.storage-decision-review-card__issue {
  @apply rounded border border-red-200 bg-red-50 px-2 py-1 text-xs leading-snug text-red-800;
}

.storage-decision-review-card__raw {
  @apply mt-2 max-h-56 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs leading-snug text-neutral-700;
}
</style>
