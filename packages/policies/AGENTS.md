# Policies Package

- This package owns the infrastructure policy endpoint process.
- Keep module-specific meaning out of this package. Definitions are imported
  from module `policies/` folders through the generated catalog.
- This package may own file storage for policy instances and endpoint process
  composition.
- Do not add module-domain procedures here. The endpoint exposes only generic
  policy management and runtime value procedures from the framework contract.
- Do not import module package roots when composing the catalog.
