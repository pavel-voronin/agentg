# AgenTG

AgenTG is a Telegram client for a personal agent.

AgenTG is not the assistant itself and not a Telegram bot. It is a Telegram client service that gives an external personal assistant controlled access to the user's Telegram data.

The first implementation target is deliberately small and concrete:

- log in as the user through Telegram client infrastructure;
- synchronize the chat list;
- read personal chats, groups, channels, and Saved Messages;
- maintain requested visible text history coverage;
- persist text-oriented Telegram data into Postgres;
- keep attachment payloads lazy while storing basic attachment metadata;
- make new Telegram messages visible in Postgres shortly after they appear in the normal Telegram client.

## Documentation

- [Docs Index](docs/README.md)
- [Vision](docs/01-product/vision.md)
- [Non-Goals](docs/01-product/non-goals.md)
- [System Overview](docs/02-architecture/system-overview.md)
- [Component Boundaries](docs/02-architecture/component-boundaries.md)
- [Domain Map](docs/03-domains/domain-map.md)
- [History](docs/03-domains/history.md)
- [Data Model](docs/04-data/data-model.md)
- [MVP](docs/09-roadmap/mvp.md)
