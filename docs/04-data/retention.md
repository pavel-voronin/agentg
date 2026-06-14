# Retention

Retention policy is not final yet.

## Initial Direction

- Keep successful Telegram inputs only as normalized Telegram domain table
  records.
- Keep modeled TDLib diagnostics only when they are bounded and useful for
  repair.
- Keep current message state as long as the user wants Telegram memory.
- Keep Telegram history coverage long enough to resume coverage convergence
  safely.

## Open Questions

- Should media payloads be retained or only metadata?
- Should private chats have stricter retention than groups?
- Should deleted Telegram messages be removed from local storage or retained as audit facts?
