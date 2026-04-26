# Non-Goals

These constraints protect the architecture from becoming expensive, noisy, or unsafe.

## Not a Generic Source Gateway

AgenTG is not a generic connector framework for arbitrary private data sources.

It should not be designed as a future WeChat, WhatsApp, email, bookmarks, or browser gateway. Those may exist elsewhere in the broader personal assistant ecosystem, but this project is specifically a Telegram client.

## Not a Lossy Message Feed Abstraction

Do not flatten Telegram into a generic `chat_messages` stream as the foundational model.

The system should preserve Telegram-specific mechanics: chats, users, messages, edits, deletes, reactions, media, topics, replies, service events, permissions, and API semantics.

## Not a Raw Telegram Firehose

Do not treat every Telegram update as immediate assistant context. The first system boundary is storage, not agent prompting.

## No Product Sending Workflow

The first implementation should not include a product workflow for sending, editing, or deleting Telegram messages.

This does not forbid a low-level Telegram client wrapper for `sendMessage`. It only means sending is not part of the first user-facing behavior.

## No Premature Intelligence Layer

Do not design the first implementation around higher-level interpretation, ranking, or assistant workflows. Those can be documented later when they become the next concrete task.
