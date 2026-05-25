<script setup lang="ts">
import { computed } from 'vue';

import type {
  StorageDecisionReview,
  StorageReviewEntry,
  StorageReviewIssue
} from '../storageReviewTypes.js';
import StorageDecisionReviewCard from './storageDecisionReviewCard.vue';

const props = defineProps<{
  compact: boolean;
  entry: StorageReviewEntry;
  reviewIndex: number;
}>();
const emit = defineEmits<{
  close: [];
}>();

const reviewIssuesByIndex = computed(
  () => new Map(props.entry.reviewIssues.map((issue) => [issue.index, issue]))
);
const reviewItem = computed(() => {
  const review = props.entry.reviews[props.reviewIndex];
  if (review === undefined) {
    return null;
  }

  return {
    index: props.reviewIndex,
    issues: reviewIssuesByIndex.value.get(props.reviewIndex)?.issues ?? [],
    rawReviewText: rawReviewText(review),
    review
  };
});

function rawReviewText(review: unknown): string {
  try {
    return JSON.stringify(review, null, 2);
  } catch {
    return String(review);
  }
}

function reviewSchema(review: unknown, issue?: StorageReviewIssue): string | null {
  if (typeof issue?.schema === 'string') {
    return issue.schema;
  }
  if (typeof review !== 'object' || review === null || Array.isArray(review)) {
    return null;
  }

  const schema = (review as { schema?: unknown }).schema;
  return typeof schema === 'string' ? schema : null;
}

function isStorageDecisionReview(review: unknown): review is StorageDecisionReview {
  return (
    typeof review === 'object' &&
    review !== null &&
    !Array.isArray(review) &&
    (review as { schema?: unknown }).schema === 'storage-decision'
  );
}
</script>

<template>
  <div :data-compact="compact ? 'true' : undefined" class="storage-review-cards">
    <template v-if="reviewItem !== null">
      <StorageDecisionReviewCard
        v-if="
          reviewSchema(reviewItem.review, reviewIssuesByIndex.get(reviewItem.index)) ===
          'storage-decision'
        "
        :compact="compact"
        :entry="entry"
        :issues="reviewItem.issues"
        :raw-review-text="reviewItem.rawReviewText"
        :review="
          isStorageDecisionReview(reviewItem.review) && reviewItem.issues.length === 0
            ? reviewItem.review
            : null
        "
        :show-close-button="!compact"
        @close="emit('close')"
      />
      <article v-else class="storage-review-cards__unsupported">
        <header class="storage-review-cards__header">
          <div class="storage-review-cards__heading">
            <span class="storage-review-cards__eyebrow">Review form issue</span>
            <h3 class="storage-review-cards__title">{{ entry.type }}</h3>
          </div>
          <span class="storage-review-cards__schema">
            {{
              reviewSchema(reviewItem.review, reviewIssuesByIndex.get(reviewItem.index)) ??
              'unknown'
            }}
          </span>
          <button
            v-if="!compact"
            :aria-label="`Close review for ${entry.type}`"
            class="storage-review-cards__close"
            title="Close review"
            type="button"
            @click.stop="emit('close')"
          >
            ×
          </button>
        </header>
        <ul class="storage-review-cards__issue-list">
          <li
            v-for="issue in reviewItem.issues.length === 0
              ? ['review.schema must be a supported schema']
              : reviewItem.issues"
            :key="issue"
            class="storage-review-cards__issue"
          >
            {{ issue }}
          </li>
        </ul>
        <pre class="storage-review-cards__raw">{{ reviewItem.rawReviewText }}</pre>
      </article>
    </template>
  </div>
</template>

<style scoped>
@reference '../style.css';

.storage-review-cards {
  @apply flex flex-col gap-2;
}

.storage-review-cards[data-compact='true'] {
  @apply w-[680px];
}

.storage-review-cards__unsupported {
  @apply rounded border border-l-4 border-l-red-500 border-neutral-200 bg-white p-3 text-neutral-950;
}

.storage-review-cards__header {
  @apply flex items-start justify-between gap-3;
}

.storage-review-cards__heading {
  @apply min-w-0;
}

.storage-review-cards__eyebrow {
  @apply text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.storage-review-cards__title {
  @apply m-0 mt-1 break-words font-mono text-base font-semibold leading-tight text-neutral-950;
}

.storage-review-cards__schema {
  @apply rounded border border-red-200 px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-red-700;
}

.storage-review-cards__close {
  @apply h-7 w-7 rounded border border-neutral-300 bg-white text-sm text-neutral-600 hover:border-neutral-500 hover:text-neutral-950;
}

.storage-review-cards__issue-list {
  @apply mt-2 flex flex-col gap-1 p-0;
}

.storage-review-cards__issue {
  @apply rounded border border-red-200 bg-red-50 px-2 py-1 text-xs leading-snug text-red-800;
}

.storage-review-cards__raw {
  @apply mt-2 max-h-56 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs leading-snug text-neutral-700;
}
</style>
