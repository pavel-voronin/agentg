import type { DatasetRow } from '@agentg/data';
import type { JsonValue } from '@agentg/framework';

export type ProcessingInput = Readonly<{
  profile: string;
  prompt: string;
  row: DatasetRow;
}>;

export type ProcessingOutput = Readonly<{
  payload?: JsonValue | undefined;
  text: string;
}>;

export type ProfileRunner = {
  hasProfile: (profile: string) => boolean;
  process: (input: ProcessingInput) => Promise<ProcessingOutput>;
};
