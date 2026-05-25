import type {
  StorageDecisionReview,
  StorageReviewEntry,
  StorageReviewMaturity,
  StorageReviewIssue
} from './storageReviewTypes.js';

export type StorageReviewButton = {
  hasAlert: boolean;
  hasNotes: boolean;
  index: number;
  key: string;
  label: string;
  maturity: StorageReviewMaturity | null;
  noteCount: number;
};

export function storageReviewButtonKey(
  entry: Pick<StorageReviewEntry, 'type'>,
  reviewIndex: number
): string {
  return `${entry.type}:${String(reviewIndex)}`;
}

export function storageReviewButtons(entry: StorageReviewEntry): StorageReviewButton[] {
  const issuesByIndex = new Map(entry.reviewIssues.map((issue) => [issue.index, issue]));

  return entry.reviews
    .map((review, index) => {
      const issue = issuesByIndex.get(index);
      const maturity = reviewMaturity(review) ?? issue?.maturity ?? null;
      const noteCount = reviewNoteCount(review);
      return {
        hasAlert: hasReviewIssue(issue) || isBlockedReview(review),
        hasNotes: noteCount > 0,
        index,
        key: storageReviewButtonKey(entry, index),
        label: maturity === null ? '?' : String(maturity),
        maturity,
        noteCount
      };
    })
    .sort((left, right) => {
      const maturityOrder = maturitySortValue(left.maturity) - maturitySortValue(right.maturity);
      return maturityOrder === 0 ? left.index - right.index : maturityOrder;
    });
}

function maturitySortValue(maturity: StorageReviewMaturity | null): number {
  return maturity ?? Number.POSITIVE_INFINITY;
}

function hasReviewIssue(issue: StorageReviewIssue | undefined): boolean {
  return issue !== undefined && issue.issues.length > 0;
}

function reviewMaturity(review: unknown): StorageReviewMaturity | null {
  if (typeof review !== 'object' || review === null || Array.isArray(review)) {
    return null;
  }

  const value = (review as { maturity?: unknown }).maturity;
  return value === 1 || value === 2 || value === 3 ? value : null;
}

function isBlockedReview(review: unknown): boolean {
  return (
    typeof review === 'object' &&
    review !== null &&
    !Array.isArray(review) &&
    (review as { status?: unknown }).status === 'blocked'
  );
}

function reviewNoteCount(review: unknown): number {
  return isStorageDecisionReview(review) ? review.notes.length : 0;
}

function isStorageDecisionReview(review: unknown): review is StorageDecisionReview {
  return (
    typeof review === 'object' &&
    review !== null &&
    !Array.isArray(review) &&
    (review as { schema?: unknown }).schema === 'storage-decision' &&
    Array.isArray((review as { notes?: unknown }).notes)
  );
}
