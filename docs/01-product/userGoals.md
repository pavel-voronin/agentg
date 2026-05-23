# User Goals

## Primary Goal

Build a Telegram client foundation for the user's own account so an external personal assistant can later use Telegram as a reliable information source.

## Relationship To Existing Assistant

The personal assistant already works with other sources such as email, bookmarks, ChatGPT tabs, local knowledge bases, and operating-system context.

AgenTG is not the assistant itself and not a Telegram bot. It is the Telegram client service for that assistant.

## First Implementation Goals

- Authenticate as the user through Telegram client infrastructure.
- Read personal chats, groups, channels, and Saved Messages.
- Synchronize the chat list.
- Maintain requested visible text history coverage.
- Persist incoming text-oriented message data in Postgres.
- Preserve replies, message identifiers, chat identifiers, sender identifiers, timestamps, and enough Telegram metadata to rebuild useful current state.
- Store attachment metadata initially.
- Download or process attachment payloads only on request or in later dedicated work.
- Store data close to Telegram's own model instead of inventing a generic message abstraction.
- Let the developer inspect stored chats and messages directly through the database.

## Product Motivation

The user has many Telegram channels and accumulated message history. The long-term value is helping the assistant work with that information without forcing the user to manually scan everything.

Do not document later assistant behavior yet. The current documentation should stay focused on making Telegram data reliably available.
