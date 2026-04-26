# Retention

Retention policy is not final yet.

## Initial Direction

- Keep raw events during early development for replay and debugging.
- Keep current message state as long as the user wants Telegram memory.
- Keep sync state long enough to resume backfill safely.

## Open Questions

- Should raw events be compacted after normalization confidence is high?
- Should media payloads be retained or only metadata?
- Should private chats have stricter retention than groups?
- Should deleted Telegram messages be removed from local storage or retained as audit facts?
