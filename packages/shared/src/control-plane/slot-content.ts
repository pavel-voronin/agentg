export type ControlPlaneContentModule = {
  default: unknown;
};

export type ControlPlaneContentDefinition = {
  contentId: string;
  load: () => Promise<ControlPlaneContentModule>;
  tags: readonly string[];
};

export type ControlPlaneContentProvider = {
  contents: readonly ControlPlaneContentDefinition[];
  domainId: string;
};
