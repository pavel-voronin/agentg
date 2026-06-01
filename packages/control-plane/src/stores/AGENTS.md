# Control Plane Stores

- This folder contains Pinia stores and store-adjacent types for the Control
  Plane shell.
- Stores may keep UI state and event stream state; they must not own module
  procedure polling loops.
- Do not import domain implementation files.
