# Telegram Type Storage Classification

This document defines the working algorithm for classifying normalized Telegram
domain types into storage kinds.

The input is an explicit list of type names. The reviewer must process that list
in order and stop only when the list is complete or when a type requires a new
storage kind that is not listed here.

## Batch Run Protocol

For each requested batch:

1. Record the exact input type list at the top of the batch result.
2. Process types strictly in the input order.
3. Write results to one batch result file.
4. Append one decision block per type.
5. Do not update the working spreadsheet during the batch unless the user asks
   for that explicitly.
6. Do not skip a type because it looks obvious.
7. Do not continue past a type that needs a new storage kind.
8. Do not continue past a type whose source evidence blocks a defensible
   decision.

The batch result file is the review artifact. The spreadsheet is updated only
after the user accepts the batch decisions.

## Output

For every processed type, write one decision block:

```text
Type: <TypeName>
Storage: <storage-kind>
Storage target: <target notation>
Decision: <short reason>
Rejected:
- table: <why not>
- embedded: <why not>
- extend: <why not>
- facet: <why not>
- pair: <why not>
- kv: <why not>
- event: <why not>
Evidence:
- constructors: <constructors and fields that matter>
- update use: <direct and indirect update use>
- type use: <direct and indirect type use>
- procedures: <procedures that accept, return, or mutate this type>
Notes:
- <model-generated note>
```

If the selected storage kind is one of the rejected kinds, omit it from
`Rejected`.

`Notes` is a flat list of model-generated review notes. It is not user
feedback, it has no acknowledgement state, and it must not imply that a human
must read every item before the next stage. Use it to preserve useful critique
inputs for later table design, including old-review deltas, implementation
constraints, key traps, owner-routing notes, and cross-type consistency risks.
If there are no useful notes, leave `Notes` empty and store an empty `notes`
array in structured review data.

If a type needs a new storage kind, do not force it into an existing kind. Write
the new storage kind proposal, explain why every existing kind fails, and stop
the run.

## Evidence Rules

The reviewer must inspect all available evidence for each type:

- All constructors of the type.
- All fields of every constructor.
- All direct update uses.
- All indirect update uses through other types.
- All direct type uses.
- All indirect type uses through other types.
- All procedures that accept the type as an argument.
- All procedures that return the type.
- All procedures that mutate state identified by the type or by values inside
  the type.
- Existing storage decisions for related owner, child, key, and value types.

Do not decide from fields alone when procedures or update usage change the
storage shape.

Do not decide from procedures alone when update usage shows that the type is
only a nested value.

Do not use TDLib constructor names as storage targets. The storage target is
written in domain type notation.

If a type has multiple legitimate embedded owners, list all owner fields:

```text
BusinessRecipients => BusinessAwayMessageSettings.recipients, BusinessGreetingMessageSettings.recipients
```

If a type appears under multiple owners but only one owner can be correct, stop
and write the ownership conflict instead of choosing silently.

## Notes Rules

Use `Notes` for facts that do not block a storage decision, but are useful
inputs for the next reviewer, implementer, or table-design agent.

Add a note when any of these conditions is true:

- The storage key is derived from a nested value, a variant field, or an update
  envelope instead of a direct id field on the type.
- The selected target depends on an external owner key, such as `chat_id`,
  `user_id`, `owner_id`, `business_connection_id`, or a procedure/update key.
- The type looks like a table candidate because it has an id-like field, but
  the selected decision is `embedded`, `facet`, `pair`, `kv`, or `event`.
- The type looks like an embedded value, but the selected decision is `table`,
  `facet`, `pair`, or `kv` because updates or procedures address it separately.
- A nested value is a canonical table type, so the owner must store a reference
  instead of duplicating the nested entity payload.
- The type is an input shape, procedure result wrapper, selector, or routing
  payload whose stored owner differs from the procedure shape.
- A procedure result is fresh data and does not by itself define cache storage.
- The schema has no native owner field for state implied by an update or
  procedure, but the decision still needs a target.
- The decision chooses between account-level `kv`, owner-scoped `facet`, and
  ordinary embedded state.
- The decision chooses `event`, or rejects `event`, based on freshness,
  restart behavior, or whether later procedures need the value.
- The type contains security-sensitive, auth, payment, revenue, passport,
  session, or account-state material.
- The type has many legitimate owners and the target list intentionally omits
  input-only, event-only, or procedure-only occurrences.
- The maturity review changes, confirms, or narrows an earlier review in a way
  that is useful input for table design.

Do not use `Notes` to restate the decision. A note must preserve a concrete
constraint, critique, caveat, or next-stage input. If there is no such edge,
leave `Notes` empty.

## Storage Kinds

### table

Use `table` when the type has its own durable identity and stores rows that can
be addressed independently.

Target notation:

```text
id
chat_id = Chat.id, user_id = User.id
connection_id = BusinessConnection.id, message.chat_id, message.id
```

Use this when the row identity belongs to the type itself or is a stable
composite key for that type.

Use `table` for owner-scoped child rows when the type has a stable local key and
procedures or updates add, delete, replace, or mutate individual rows by the
owner key plus that local key.

Owner-scoped table test:

- If many values of the same type can exist for one owner, and each value has a
  stable local key, prefer `table` with a composite key.
- If procedures or updates address one child value by owner key plus child key,
  prefer `table`.
- If the child key is documented as globally unique, use the child key as the
  table key and keep owner ids as relationships, not as the primary identity.

Reject `table` when the apparent identifier is only an owner key supplied by an
update envelope and the type has no independent lifecycle.

### embedded

Use `embedded` when the type is a value stored inside another type field.

Target notation:

```text
Chat.background
UserFullInfo.business_info
BusinessInfo.opening_hours
ChatPosition.list
```

Use this when the type has no standalone row identity and is always meaningful
as a field value of its owner.

If the embedded value contains a nested `table` type, store a domain reference
to the table row instead of duplicating the full table object.

Use `embedded` for TDLib result or update wrapper types when the constructor
only wraps the returned payload, such as a list or a single value, and carries
no durable state of its own. The wrapper stays embedded even if the surrounding
function or update envelope has an owner key. In that case the key scopes the
request or update, not the wrapper type itself.

Wrapper test:

- If replacing the wrapper with its payload field would lose no stored state,
  the wrapper is embedded.
- If the envelope key is the only key, and the constructor has no state beyond
  the payload field, the wrapper is embedded.
- If child items inside the payload need owner-scoped rows, classify the child
  item separately; do not turn the wrapper into a facet only because the child
  items may need keyed storage.

Reject `embedded` when the value must be updated, deleted, or addressed by an
external owner key without replacing an owner field.

### extend

Use `extend` when a type has no own identity, but extends exactly one owner type
identified outside the object.

Target notation:

```text
BasicGroup
Supergroup
User
```

Use this for full-info style types where the update carries the owner id and the
object carries additional fields for that owner.

Reject `extend` when the value is not a structural extension of the owner row or
when more than one value can exist for the same owner.

### facet

Use `facet` when a type is tied to an owner entity by an external or local owner
key, but should not be merged into the owner row.

Target notation:

```text
bot_user_id = User.id
chat_id = Chat.id
chat_id = Chat.id, list_key = ChatList.key
```

Use this when the type is a separate aspect of an owner, has its own update
shape, or has a key derived from owner fields.

An external owner key is not enough for `facet`. The type must carry state that
would be stored as its own owner-scoped record. Reject `facet` for a constructor
that only wraps a payload field from a function result or update field.

Reject `facet` when the value is one row in an owner-scoped collection and has a
stable local key. That is an owner-scoped `table`, not a facet. Use `facet` for
one aspect value per owner key, not for keyed child collections.

Reject `facet` when the type is just an ordinary field of the owner and can be
stored as embedded data without losing the write shape.

### pair

Use `pair` when two types only form a stored value together: one type is the key
shape and the other type is the value shape.

Target notation:

```text
AutosaveSettingsScope => ScopeAutosaveSettings
NotificationSettingsScope => ScopeNotificationSettings
```

Use this when neither side should be stored alone and the persistent record is
the association between both sides.

Reject `pair` when one side has an owner row target or independent identity.

### kv

Use `kv` for account-level or global cached values keyed by a stable domain
name, not by a domain entity id.

Target notation:

```text
authorization_state
accent_colors
age_verification_parameters
```

Use this for singleton snapshots, catalogs, and account-level values that do not
belong to a specific domain entity type.

Reject `kv` when the value belongs to a `Chat`, `User`, `Message`, or another
domain entity through a stable owner key.

### event

Use `event` when the normalized type must be emitted to live consumers and must
not be persisted as state.

Target notation:

```text
Chat.action
```

Use this for ephemeral signals whose history is not part of the cache state.

Reject `event` when the type represents current state needed after restart or
needed by later procedures.

## Decision Algorithm

For each input type:

1. Load the type definition.
2. List constructors and fields.
3. List direct update use.
4. List indirect update use with the intermediate owner types.
5. List direct type use.
6. List indirect type use with the intermediate owner types.
7. List procedures that accept the type.
8. List procedures that return the type.
9. List procedures that mutate state connected to the type.
10. Identify whether the type has its own identity inside its own fields.
11. Identify whether any identity comes only from an update envelope or owner
    type.
12. Identify whether the type is a result/update wrapper. Apply the wrapper
    test before considering `facet`.
13. Identify whether the type is an owner-scoped child row. Apply the
    owner-scoped table test before considering `facet`.
14. Identify whether the type is a key, value, owner extension, owner facet,
    embedded field, standalone entity, account-level value, or live-only signal.
15. Choose one storage kind and target.
16. Explain why the chosen kind fits.
17. Explain why every other current storage kind does not fit.
18. Run the notes check and record every useful non-blocking note.
19. If no current storage kind fits, propose a new storage kind and stop.

## Stop Conditions

Stop the run when:

- The input type list is complete.
- A type requires a new storage kind.
- The source evidence is missing or contradictory enough that a storage decision
  would be guesswork.

When stopping on missing or contradictory evidence, write the exact missing fact
that blocks the decision.

## Required Review Checks

Before finalizing a batch, verify:

- Every input type has exactly one decision block.
- Every decision has a storage kind.
- Every decision has a storage target unless the storage kind explicitly has no
  target.
- Every decision lists procedure evidence, including an explicit `none` when no
  procedures use the type.
- Every decision has a `Notes` section or structured `notes` array.
- Empty `Notes` means no useful note applies.
- Every note describes a concrete critique, risk, implementation constraint, or
  later table-design input, not a restatement of the chosen storage kind.
- No note is filler, generic caution, or a written `none`.
- No storage target names an update as the owner.
- No storage target uses TDLib constructor names as domain targets.
- No `embedded` decision points to a target type that is itself absent from the
  reviewed type set and from existing accepted decisions.
- No `facet` decision omits the key relation.
- No `facet` decision relies only on an owner key from a function or update
  envelope when the constructor is only a payload wrapper.
- No `facet` decision stores a keyed child collection row that has a stable
  local key; those rows must be `table`.
- No `table` decision omits the primary key.
- No `pair` decision stores only one side of the pair.
- No `event` decision persists state.
