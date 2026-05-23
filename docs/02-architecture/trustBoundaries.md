# Trust Boundaries

## High-Trust Zone

The TDLib sidecar and session storage are high-trust components because they can access the user's Telegram account.

Controls:

- isolate process boundaries
- encrypt or protect session storage
- avoid exposing credentials to unrelated services
- keep write-like actions explicit and auditable

## External Access Zone

External access is not defined for the first implementation. The first implementation should prove Telegram connectivity and storage before adding broader API surfaces.

## Write Boundary

Any action that sends from the user's account is sensitive. A low-level client wrapper may exist for validation or manual use, but the first implementation should focus on reading and storing Telegram data.

Sensitive actions:

```text
send message
edit message
delete message
```
