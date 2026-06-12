# History Sync Runner

- This folder contains the background sync controller, executor, and interval
  reconciliation logic.
- It may use History Sync storage, range helpers, events, and the public Telegram
  domain procedure client passed from module setup.
- Do not import Telegram implementation files, TDLib code, or Dashboard
  frontend code.
- Do not choose Telegram fetch/page/cursor/TDLib/file materialization strategy
  from this runner. The runner expresses desired history convergence; Telegram
  owns the mechanics.
