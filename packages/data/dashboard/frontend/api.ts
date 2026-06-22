import { useDashboardHost } from '@agentg/framework/dashboard';

import {
  METHODS,
  type AnnotationPage,
  type CollectionPage,
  type DatasetPage,
  type ModelRef,
  type Overview
} from '../contracts.js';

type KeyPageInput = {
  key?: string;
  limit: number;
  offset: number;
  sort?: PageSort | undefined;
  subject?: ModelRef | undefined;
  subjectModel?: string | undefined;
  where?: unknown;
};

type ModelPageInput = {
  limit: number;
  model: string;
  offset: number;
  sort?: PageSort | undefined;
  where?: unknown;
};

type PageSort = {
  direction: 'asc' | 'desc';
  key: string;
};

export function useDashboardApi() {
  const host = useDashboardHost();

  return {
    overview(): Promise<Overview> {
      return host.rpc<Overview>(METHODS.overview);
    },
    browseAnnotations(input: KeyPageInput): Promise<AnnotationPage> {
      return host.rpc<AnnotationPage>(METHODS.browseAnnotations, input);
    },
    browseCollection(input: KeyPageInput): Promise<CollectionPage> {
      return host.rpc<CollectionPage>(METHODS.browseCollection, input);
    },
    selectPage(input: ModelPageInput): Promise<DatasetPage> {
      return host.rpc<DatasetPage>(METHODS.selectPage, input);
    }
  };
}
