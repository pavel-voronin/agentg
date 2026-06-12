# Get Messages Procedure Tests

- This folder contains focused tests for internal helpers that support the
  public `telegram.getMessages` contract.
- Tests here may import internal procedure files by relative path. Do not widen
  package-root exports for test convenience.
- Keep assertions on behavior and contract semantics: request id stability,
  ready/pending shape, owner/selector handling, and absence of TDLib leakage.
