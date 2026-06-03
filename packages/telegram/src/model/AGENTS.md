# Model References

- This folder owns stable internal model reference helpers.
- Keep refs independent from TDLib clients and database query logic.
- String model identifiers may contain the persisted `telegram.*` namespace;
  local TypeScript identifiers must stay package-local and avoid package-name
  prefixes.
