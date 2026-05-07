export type SurfaceProcedureKind = 'mutation' | 'query';

export type SurfaceProcedureRecord = {
  kind: SurfaceProcedureKind;
  name: string;
};

export type SurfaceProcedure<Runtime, Procedure> = {
  create(runtime: Runtime): Procedure;
  kind: SurfaceProcedureKind;
};

type SurfaceProcedureMap<Runtime> = Record<string, SurfaceProcedure<Runtime, unknown>>;

type SurfaceRouterRecord<Runtime, Procedures extends SurfaceProcedureMap<Runtime>> = {
  [Name in keyof Procedures]: ReturnType<Procedures[Name]['create']>;
};

export type SurfaceDefinition<Runtime, Procedures extends SurfaceProcedureMap<Runtime>> = {
  procedures(): SurfaceProcedureRecord[];
  router(runtime: Runtime): SurfaceRouterRecord<Runtime, Procedures>;
};

export function query<Runtime, Procedure>(
  create: (runtime: Runtime) => Procedure
): SurfaceProcedure<Runtime, Procedure> {
  return {
    create,
    kind: 'query'
  };
}

export function mutation<Runtime, Procedure>(
  create: (runtime: Runtime) => Procedure
): SurfaceProcedure<Runtime, Procedure> {
  return {
    create,
    kind: 'mutation'
  };
}

export function surface<Runtime, const Procedures extends SurfaceProcedureMap<Runtime>>(
  slug: string,
  procedures: Procedures
): SurfaceDefinition<Runtime, Procedures> {
  return {
    procedures() {
      return Object.entries(procedures).map(([name, procedure]) => ({
        kind: procedure.kind,
        name: `${slug}.${name}`
      }));
    },
    router(runtime) {
      return Object.fromEntries(
        Object.entries(procedures).map(([name, procedure]) => [name, procedure.create(runtime)])
      ) as SurfaceRouterRecord<Runtime, Procedures>;
    }
  };
}
