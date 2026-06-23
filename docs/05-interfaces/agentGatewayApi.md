# Agent Gateway API

## Purpose

Agent Gateway is the external WebSocket API boundary for agent-side clients.
Gateway keeps NATS and internal module RPC services private. It exposes only the
Gateway RPC methods explicitly owned by this document and only the live events
explicitly allowed here.

Gateway does not expose capability registration, capability calls, raw NATS
subjects, database rows, or raw TDLib payloads.

## Runtime

```text
Telegram ingestion
  -> Postgres
  -> NATS Core subjects
  <- internal module RPC

Agent Gateway
  <- NATS Core subject telegram.login.completed
  -> WebSocket clients
  <-> typed Telegram internal RPC client for allowed Telegram methods
  <-> typed Policies internal RPC client for allowed policy control methods
  <-> typed Data internal RPC client for allowed data methods
  <-> typed Pipelines internal RPC client for allowed pipeline methods
```

Start locally:

```sh
npm run dev:up
```

For manual process starts, Gateway's documented Data and Pipeline methods need
the serving module processes as well as Gateway itself:

```sh
docker compose up -d postgres nats
npm run dev:policies
npm run dev:telegram
npm run dev:data
npm run dev:pipelines
npm run dev:gateway
```

Configuration:

- `NATS_URL`, default `nats://localhost:4222`
- `GATEWAY_HOST`, default `127.0.0.1`
- `GATEWAY_PORT`, default `8787`
- `GATEWAY_TOKEN`, optional bearer token
- `TELEGRAM_RPC_URL`, default `http://127.0.0.1:8702`
- `POLICIES_RPC_URL`, default `http://127.0.0.1:8705`
- `DATA_RPC_URL`, default `http://127.0.0.1:8708`
- `PIPELINES_RPC_URL`, default `http://127.0.0.1:8709`

When `GATEWAY_TOKEN` is set, connect with the WebSocket
`Authorization` header:

```text
Authorization: Bearer ...
```

## External Events

Gateway forwards exactly one live integration event to external WebSocket
clients:

- `telegram.login.completed`

The notification payload uses the integration event envelope:

```json
{
  "event": {
    "id": "evt_...",
    "type": "telegram.login.completed",
    "at": "2026-05-05T00:00:00.000Z",
    "data": {}
  }
}
```

All other NATS subjects remain internal.

## RPC Protocol

Client requests are JSON objects:

```json
{
  "id": "req_1",
  "method": "telegram.getChat",
  "params": {
    "chatId": "123"
  }
}
```

Responses:

```json
{
  "id": "req_1",
  "result": {}
}
```

Errors:

```json
{
  "id": "req_1",
  "error": {
    "code": "unknown_method",
    "message": "Unknown method: example"
  }
}
```

Gateway error codes:

- `unknown_method`: the external method is not part of Gateway's public API.
- `dependency_unavailable`: the method is allowed, but the internal RPC
  dependency failed at the transport or protocol boundary before returning a
  domain result.
- `method_failed`: the method reached domain logic and failed with a domain
  procedure error.

## Method Rules

Gateway exposes only the explicit methods listed here. It is not a generic
module RPC proxy and it does not expose dynamic capability registration or
arbitrary method calls.

Gateway calls internal modules only through package-owned typed clients. Gateway
does not read module storage, call TDLib, access NATS request/reply, or enrich
module results.

## Codex MCP Tools

Codex MCP is an explicit tool surface over Gateway, not a dynamic Gateway
proxy. Every Gateway method in this document that is needed by external agent
workflows must have a matching MCP tool that validates its own input schema,
calls the documented Gateway method, and returns the Gateway result unchanged.

The first implementation must add MCP tools for the Data and Pipeline methods in
this document. The tool names use the existing snake_case package convention:

- `data_list_models`
- `data_select`
- `data_get`
- `data_expand`
- `data_render`
- `data_get_annotation`
- `data_list_annotations`
- `data_write_annotation`
- `data_list_collection`
- `data_get_collection_item`
- `data_write_collection_item`
- `pipelines_list_pipelines`
- `pipelines_get_pipeline`
- `pipelines_set_pipeline`
- `pipelines_run_pipeline`
- `pipelines_get_run`
- `pipelines_list_runs`
- `pipelines_delete_pipeline`

Codex MCP must not expose arbitrary Gateway calls, module RPC calls, TDLib
operations, storage reads, or undeclared pipeline provider actions.

## Telegram Methods

Telegram methods call Telegram ingestion through the typed `@agentg/telegram`
internal RPC client and return Telegram domain procedure results directly.

`telegram.getChat`

```json
{
  "chatId": "123"
}
```

Example result:

```json
{
  "chat": {
    "_model": "telegram.chat",
    "id": "123",
    "title": "Saved Messages",
    "type": "private",
    "updatedAt": "2026-05-05T00:00:00.000Z"
  }
}
```

`telegram.listRecentMessages`

```json
{
  "beforeMessageId": "1000",
  "chatId": "123",
  "limit": 50
}
```

`telegram.getMessages`

```json
{
  "owner": {
    "kind": "chat",
    "chatId": "123"
  },
  "selector": {
    "kind": "page",
    "limit": 50
  }
}
```

`telegram.searchMessages`

```json
{
  "chatId": "123",
  "limit": 20,
  "query": "policy"
}
```

`telegram.requestFile`

```json
{
  "owner": {
    "_model": "telegram.message",
    "id": "123:456"
  },
  "slotKey": "photo"
}
```

Telegram owns selectors, message readiness, history coverage, file request
decisions, and Telegram provider capabilities for `data`. Gateway only forwards
allowed domain requests and returns domain results.

## Data Methods

Data methods call the typed `@agentg/data` internal RPC client. Gateway exposes
the data operations used by agent-authored pipelines and direct inspection.

`data.listModels`

```json
{}
```

`data.select`

```json
{
  "model": "telegram.chat",
  "where": {
    "readState": "unread"
  },
  "limit": 50,
  "offset": 0,
  "sort": {
    "direction": "asc",
    "key": "title"
  }
}
```

`data.get`

```json
{
  "ref": {
    "_model": "telegram.chat",
    "id": "-1002129631268"
  }
}
```

`data.expand`

```json
{
  "from": [
    {
      "value": {
        "title": "Subcreative Community"
      },
      "refs": {
        "chat": {
          "_model": "telegram.chat",
          "id": "-1002129631268"
        }
      },
      "lineage": [
        {
          "_model": "telegram.chat",
          "id": "-1002129631268"
        }
      ]
    }
  ],
  "relation": "messages",
  "sourceRef": "chat",
  "where": {
    "readState": "unread"
  },
  "limit": 50
}
```

`data.render`

```json
{
  "from": [
    {
      "value": {
        "text": "hello"
      },
      "refs": {
        "chat": {
          "_model": "telegram.chat",
          "id": "-1002129631268"
        },
        "message": {
          "_model": "telegram.message",
          "id": "-1002129631268:456"
        }
      },
      "lineage": [
        {
          "_model": "telegram.chat",
          "id": "-1002129631268"
        },
        {
          "_model": "telegram.message",
          "id": "-1002129631268:456"
        }
      ]
    }
  ],
  "format": "text",
  "options": {
    "groupByRef": "chat"
  },
  "sourceRef": "message"
}
```

`data.getAnnotation`

```json
{
  "subject": {
    "_model": "telegram.chat",
    "id": "-1002129631268"
  },
  "key": "unreadSummary"
}
```

`data.listAnnotations`

```json
{
  "subject": {
    "_model": "telegram.chat",
    "id": "-1002129631268"
  }
}
```

`data.writeAnnotation`

```json
{
  "subject": {
    "_model": "telegram.chat",
    "id": "-1002129631268"
  },
  "key": "unreadSummary",
  "mode": "replace",
  "value": "One sentence summary."
}
```

`data.listCollection`

```json
{
  "subject": {
    "_model": "telegram.chat",
    "id": "-1002129631268"
  },
  "key": "subjects"
}
```

`data.getCollectionItem`

```json
{
  "subject": {
    "_model": "telegram.chat",
    "id": "-1002129631268"
  },
  "key": "subjects",
  "itemId": "pricing"
}
```

`data.writeCollectionItem`

```json
{
  "subject": {
    "_model": "telegram.chat",
    "id": "-1002129631268"
  },
  "key": "subjects",
  "itemId": "pricing",
  "mode": "merge",
  "value": {
    "title": "Pricing"
  }
}
```

`append` mode creates a new collection item and must omit `itemId`. `replace`
and `merge` update an addressed item and require `itemId`.

## Pipeline Methods

Pipeline methods call the typed `@agentg/pipelines` internal RPC client.
Durable scheduled automation is configured through `policies.setInstance` with
`kind: PipelineAutomationRule`. Direct `pipelines.setPipeline` and
`pipelines.deletePipeline` are dev/test escape hatches for materialized pipeline
documents.

`pipelines.listPipelines`

```json
{}
```

`pipelines.getPipeline`

```json
{
  "name": "subcreativeUnreadSummary"
}
```

`pipelines.setPipeline` dev/test only

```json
{
  "document": {
    "apiVersion": "agentg.dev/v1",
    "kind": "Pipeline",
    "metadata": {
      "name": "subcreativeUnreadSummary"
    },
    "spec": {
      "nodes": {
        "chats": {
          "use": "data.select",
          "with": {
            "model": "telegram.chat",
            "where": {
              "readState": "unread"
            }
          }
        }
      }
    }
  }
}
```

`pipelines.runPipeline`

```json
{
  "name": "subcreativeUnreadSummary",
  "idempotencyKey": "manual_2026_06_21_001"
}
```

`pipelines.getRun`

```json
{
  "runId": "run_123"
}
```

`pipelines.listRuns`

```json
{
  "pipelineName": "subcreativeUnreadSummary",
  "status": "completed"
}
```

`pipelines.deletePipeline`

```json
{
  "name": "subcreativeUnreadSummary"
}
```

## Policy Methods

Policy methods call the typed policy endpoint client from
`@agentg/framework/policies`. `policies` owns document envelopes, validation,
storage, resolved policy values, and policy update events. Module-owned policy
`spec` semantics stay with the module that defines the policy kind.

`policies.listPolicyKinds`

```json
{}
```

`policies.listInstances`

```json
{
  "kind": "ExampleRule",
  "labels": {
    "area": "local"
  },
  "moduleId": "example"
}
```

`policies.getInstance`

```json
{
  "kind": "ExampleRule",
  "name": "example"
}
```

`policies.setInstance`

```json
{
  "document": {
    "apiVersion": "agentg.dev/v1",
    "kind": "PipelineAutomationRule",
    "metadata": {
      "name": "subcreativeUnreadSummary"
    },
    "spec": {
      "enabled": true,
      "trigger": {
        "kind": "periodic",
        "everySeconds": 86400
      },
      "pipeline": {
        "nodes": {
          "messages": {
            "use": "data.select",
            "with": {
              "model": "telegram.message",
              "where": {
                "readState": "unread"
              }
            }
          }
        }
      }
    }
  }
}
```

`policies.deleteInstance`

```json
{
  "kind": "ExampleRule",
  "name": "example"
}
```

`policies.getPolicyValue`

```json
{
  "kind": "ExampleRule"
}
```

`setInstance` and `deleteInstance` return policy mutation results. Expected
policy contract failures return `status: "rejected"` in the result body.
Transport and protocol failures return Gateway `dependency_unavailable` errors.

## Acceptance Test Contract

- Gateway exposes only the documented Telegram, Data, Pipeline, and Policy
  methods.
- Codex MCP exposes explicit tools for the documented Data and Pipeline Gateway
  methods and does not expose a generic Gateway call tool.
- Unknown Gateway method names return `unknown_method`.
- Gateway calls Telegram, Data, Pipelines, and Policies only through their typed
  internal clients.
- Gateway does not expose arbitrary module RPC, capability registration, NATS
  subjects, TDLib payloads, or database rows.
- Data methods forward request payloads to the typed Data client and return Data
  domain results directly.
- Pipeline methods forward request payloads to the typed Pipelines client and
  return Pipeline domain results directly.
- Policy methods continue to return policy mutation results for expected
  contract failures and Gateway dependency errors for transport or protocol
  failures.
- Telegram methods continue to hide TDLib, storage, coverage, and file
  reconciliation mechanics behind Telegram domain procedures.
