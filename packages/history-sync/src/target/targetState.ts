import type { HistorySyncTarget } from '../model/types.js';
import { isRelativeHistorySyncTarget } from './store.js';

export type TargetState = {
  delete(targetId: string): void;
  hasRelativeTargets(): boolean;
  replace(targets: readonly HistorySyncTarget[]): void;
  targets(): HistorySyncTarget[];
  upsert(target: HistorySyncTarget): void;
};

export function createTargetState(): TargetState {
  let targets: HistorySyncTarget[] = [];
  let relativeTargetCount = 0;

  const replace = (nextTargets: readonly HistorySyncTarget[]): void => {
    targets = [...nextTargets];
    relativeTargetCount = targets.filter(isRelativeHistorySyncTarget).length;
  };

  return {
    delete(targetId) {
      replace(targets.filter((target) => target.id !== targetId));
    },
    hasRelativeTargets() {
      return relativeTargetCount > 0;
    },
    replace,
    targets() {
      return [...targets];
    },
    upsert(target) {
      const index = targets.findIndex((candidate) => candidate.id === target.id);
      if (index < 0) {
        replace([...targets, target]);
        return;
      }
      replace(
        targets.map((candidate, candidateIndex) => (candidateIndex === index ? target : candidate))
      );
    }
  };
}
