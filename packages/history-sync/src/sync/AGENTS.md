# History Sync Runner

- This folder contains the background sync controller, executor, and interval
  reconciliation logic.
- It may use History Sync storage, range helpers, events, and the public Telegram
  procedure client passed from module setup.
- Do not import Telegram implementation files, TDLib code, or Control Plane
  frontend code.
