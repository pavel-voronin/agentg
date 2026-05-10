/* global console */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const DOMAIN_MODEL_CATALOG_PATH = new URL('docs/04-data/tdlib-domain-model.catalog.json', ROOT);
const CATALOG_PATH = new URL('docs/04-data/tdlib-field-routing.catalog.json', ROOT);
const MARKDOWN_PATH = new URL('docs/04-data/tdlib-field-routing.generated.md', ROOT);

const SCHEMA_COMMIT = '49b3bcbb6bfebf2ed44dd9f25102d2e1a94a58c4';
const SCHEMA_URL = `https://raw.githubusercontent.com/tdlib/td/${SCHEMA_COMMIT}/td/generate/scheme/td_api.tl`;
const SCHEMA_SHA256 = '1a0d13cebb0c04a866da3aac55bb6b47b084b4a789877ab019348c5374f4f2d2';

const CONTROL_TABLES = [
  'telegram_procedure_observations',
  'telegram_projection_gaps',
  'telegram_schema_versions'
];

const BASIC_TYPES = new Set(['Bool', 'bytes', 'double', 'int32', 'int53', 'int64', 'string']);

const STORE_POLICIES = {
  derive: 'derive',
  dispatch: 'dispatch',
  redact: 'redact',
  storeColumn: 'store_column',
  storeEdge: 'store_edge',
  storePayload: 'store_payload',
  ttl: 'ttl'
};

const schemaText = await fetchSchemaText();
const schemaHash = createHash('sha256').update(schemaText).digest('hex');
if (schemaHash !== SCHEMA_SHA256) {
  throw new Error(`TDLib schema hash mismatch: expected ${SCHEMA_SHA256}, got ${schemaHash}`);
}

const domainModelCatalog = JSON.parse(await readFile(DOMAIN_MODEL_CATALOG_PATH, 'utf8'));
const parsed = parseTdSchema(schemaText);
validateDomainModelCatalog(domainModelCatalog);
const logicalToPhysical = logicalProjectionMappingFromCatalog(domainModelCatalog);
const physicalTables = domainModelCatalog.physicalTables.map((table) => table.name).sort();
const updateToLogicalProjection = updateProjectionCoverageFromCatalog(domainModelCatalog);
const validTables = new Set([...physicalTables, ...CONTROL_TABLES]);

const objectFieldRoutes = parsed.constructors.flatMap((constructor) =>
  constructor.fields.map((field) => routeObjectField(constructor, field))
);
const functionRequestFieldRoutes = parsed.functions.flatMap((func) =>
  func.fields.map((field) => routeFunctionRequestField(func, field))
);
const functionResponseRoutes = parsed.functions.map(routeFunctionResponse);

validateRoutes({
  functionRequestFieldRoutes,
  functionResponseRoutes,
  objectFieldRoutes,
  validTables
});

const catalog = {
  schema: {
    commit: SCHEMA_COMMIT,
    sha256: SCHEMA_SHA256,
    url: SCHEMA_URL
  },
  counts: {
    functionRequestFields: functionRequestFieldRoutes.length,
    functionResponses: functionResponseRoutes.length,
    functions: parsed.functions.length,
    ignoredRoutes: 0,
    objectConstructors: parsed.constructors.length,
    objectFields: objectFieldRoutes.length,
    objectTypes: new Set(parsed.constructors.map((constructor) => constructor.resultType)).size,
    physicalDomainTables: physicalTables.length
  },
  policyCounts: countBy(
    [
      ...objectFieldRoutes.map((route) => route.route.policy),
      ...functionRequestFieldRoutes.map((route) => route.route.policy),
      ...functionResponseRoutes.map((route) => route.route.policy)
    ],
    (policy) => policy
  ),
  physicalTables,
  routes: {
    functionRequestFields: functionRequestFieldRoutes,
    functionResponses: functionResponseRoutes,
    objectFields: objectFieldRoutes
  }
};

await mkdir(new URL('docs/04-data/', ROOT), { recursive: true });
await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
await writeFile(MARKDOWN_PATH, renderMarkdown(catalog));

console.log(
  JSON.stringify(
    {
      functionRequestFields: catalog.counts.functionRequestFields,
      functionResponses: catalog.counts.functionResponses,
      objectFields: catalog.counts.objectFields,
      output: {
        catalog: 'docs/04-data/tdlib-field-routing.catalog.json',
        markdown: 'docs/04-data/tdlib-field-routing.generated.md'
      },
      physicalDomainTables: catalog.counts.physicalDomainTables,
      policyCounts: catalog.policyCounts
    },
    null,
    2
  )
);

async function fetchSchemaText() {
  const response = await fetch(SCHEMA_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch TDLib schema: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseTdSchema(text) {
  const [objectPart, functionPart = ''] = text.split(/---functions---/);
  return {
    constructors: parseTlDeclarations(objectPart, 'object'),
    functions: parseTlDeclarations(functionPart, 'function')
  };
}

function parseTlDeclarations(text, kind) {
  const declarations = [];
  const expression =
    kind === 'object'
      ? /^([A-Za-z][A-Za-z0-9_]*)\b(.*?)=\s*([A-Za-z][A-Za-z0-9_]*)\s*;/
      : /^([a-z][A-Za-z0-9_]*)\b(.*?)=\s*([A-Za-z][A-Za-z0-9_]*)\s*;/;

  for (const line of text.split('\n')) {
    const match = line.trim().match(expression);
    if (match === null) {
      continue;
    }

    declarations.push({
      fields: parseTlFields(match[2]),
      kind,
      name: match[1],
      resultType: match[3]
    });
  }
  return declarations;
}

function parseTlFields(fieldsText) {
  return fieldsText
    .trim()
    .split(/\s+/)
    .filter((token) => /^[a-z][A-Za-z0-9_]*:/.test(token))
    .map((token) => {
      const separatorIndex = token.indexOf(':');
      return {
        name: token.slice(0, separatorIndex),
        type: token.slice(separatorIndex + 1)
      };
    });
}

function validateDomainModelCatalog(catalog) {
  if (catalog.schema.commit !== SCHEMA_COMMIT) {
    throw new Error(
      `Domain model catalog TDLib commit mismatch: expected ${SCHEMA_COMMIT}, got ${catalog.schema.commit}`
    );
  }
  if (catalog.schema.sha256 !== SCHEMA_SHA256) {
    throw new Error(
      `Domain model catalog TDLib SHA mismatch: expected ${SCHEMA_SHA256}, got ${catalog.schema.sha256}`
    );
  }
}

function logicalProjectionMappingFromCatalog(catalog) {
  return new Map(
    catalog.logicalProjectionMappings.map((mapping) => [
      mapping.logicalProjection,
      mapping.physicalTable
    ])
  );
}

function updateProjectionCoverageFromCatalog(catalog) {
  return new Map(
    catalog.updateProjectionCoverage.flatMap((projection) =>
      projection.updates.map((update) => [update, projection.projectionGroup])
    )
  );
}

function routeObjectField(constructor, field) {
  const rootRoute = rootRouteForConstructor(constructor);
  const route = fieldRoute(constructor, field, rootRoute);
  return {
    constructor: constructor.name,
    field: field.name,
    fieldType: field.type,
    resultType: constructor.resultType,
    route
  };
}

function rootRouteForConstructor(constructor) {
  if (constructor.resultType === 'Update') {
    const logicalProjection = updateToLogicalProjection.get(constructor.name);
    if (logicalProjection === undefined) {
      return {
        logicalProjection: 'telegram_projection_gaps',
        physicalTable: 'telegram_projection_gaps',
        reason: 'Unknown update constructor for pinned coverage.',
        storagePath: 'gap.payload'
      };
    }
    const physicalTable = resolveProjectionGroupPhysicalTable(logicalProjection);
    return {
      logicalProjection,
      physicalTable,
      reason: `TDLib update ${constructor.name} is assigned to ${logicalProjection}; physical destination is ${physicalTable}.`,
      storagePath: `${physicalTable}.normalized`
    };
  }

  const physicalTable = classifyDataTypeToPhysicalTable(constructor.resultType, constructor.name);
  return {
    logicalProjection: physicalTable,
    physicalTable,
    reason: `${constructor.resultType} objects normalize into ${physicalTable}.`,
    storagePath: `${physicalTable}.normalized`
  };
}

function fieldRoute(constructor, field, rootRoute) {
  if (isSensitiveField(constructor, field)) {
    return {
      policy: STORE_POLICIES.redact,
      physicalTable: rootRoute.physicalTable,
      reason: 'Sensitive credential, secret, token, local path, or payment/passport payload.',
      storagePath: `${rootRoute.physicalTable}.redacted.${field.name}`
    };
  }

  if (isRuntimeField(constructor, field, rootRoute.physicalTable)) {
    return {
      policy: STORE_POLICIES.ttl,
      physicalTable: rootRoute.physicalTable,
      reason: 'Runtime or transient state; store with bounded retention or as latest state only.',
      storagePath: `${rootRoute.physicalTable}.ttl.${field.name}`
    };
  }

  const fieldPhysicalTable = fieldSpecificPhysicalTable(
    constructor,
    field,
    rootRoute.physicalTable
  );
  const storagePolicy = storagePolicyForField(field, fieldPhysicalTable, rootRoute.physicalTable);
  return {
    policy: storagePolicy.policy,
    physicalTable: fieldPhysicalTable,
    reason: storagePolicy.reason,
    storagePath: storagePathForField(field, fieldPhysicalTable, storagePolicy.policy)
  };
}

function routeFunctionRequestField(func, field) {
  const policy = isSensitiveFunctionRequest(func, field)
    ? STORE_POLICIES.redact
    : isDiagnosticFunction(func)
      ? STORE_POLICIES.ttl
      : STORE_POLICIES.storePayload;
  return {
    field: field.name,
    fieldType: field.type,
    method: func.name,
    responseType: func.resultType,
    route: {
      policy,
      physicalTable: 'telegram_procedure_observations',
      reason:
        policy === STORE_POLICIES.redact
          ? 'Outgoing request field is sensitive and must be redacted in observations.'
          : policy === STORE_POLICIES.ttl
            ? 'TDLib diagnostic/test request field has bounded retention.'
            : 'Outgoing request field is command metadata, not Telegram domain state.',
      storagePath:
        policy === STORE_POLICIES.redact
          ? `telegram_procedure_observations.request_redacted.${field.name}`
          : `telegram_procedure_observations.request.${field.name}`
    }
  };
}

function routeFunctionResponse(func) {
  const family = classifyFunctionReturn(func);
  const route = responseRouteForFamily(family);
  return {
    method: func.name,
    responseType: func.resultType,
    route
  };
}

function classifyFunctionReturn(func) {
  const returnType = func.resultType;
  if (returnType === 'Ok') {
    return 'operation_effect';
  }
  if (/^(Error|Update|Updates)$/.test(returnType)) {
    return 'update_dispatch_or_error';
  }
  if (/^Test/.test(returnType)) {
    return 'tdlib_diagnostics';
  }
  if (
    /(Authorization|Authentication|Password|Passkey|Passkeys|Email|Phone|Session|ConnectedWebsite|Log|NetworkStatistics|Option|Settings|ScopeNotification|Notification|SuggestedAction|Terms|Proxy|AddedProxies|StorageStatistics|DatabaseStatistics|DeviceToken|PushReceiverId|Can|Seconds|Count|Text|HttpUrl|Countries|Country|Language|Localization|Premium|Star|Ton|Revenue|Payment|Invoice|Order|Shipping|Giveaway|Gift|Passport|Identity|Bank|Address|Firebase|Autosave|AccountTtl|TimeZones|CurrentWeather|Data|JsonValue|PublicPost|PublicPosts|PublicForwards|SearchLimits|Hashtag|Hashtags|FoundPosition|FoundPositions|Outline|WebPageInstantView|TMe|Link|Qr|DeepLink|Statistical|Statistics|ArchiveChatListSettings|Birthdate|Birthdays|Collectible|StorePayment|Product|Affiliate|Referral|ConnectedAffiliate)/.test(
      returnType
    )
  ) {
    return 'account_catalog_or_operation';
  }
  if (
    /(Bot|Business|WebApp|Inline|Callback|Query|Custom|Menu|PreparedInline|Input|SentWebApp|KeyboardButton|GameHighScores|Rtmp)/.test(
      returnType
    )
  ) {
    return 'bot_business_projection';
  }
  if (
    /(Sticker|Emoji|Animation|Dice|Sound|Background|Theme|Accent|AttachmentMenu|MessageEffect)/.test(
      returnType
    )
  ) {
    return 'catalog_projection';
  }
  if (
    /(Chat|Supergroup|BasicGroup|SecretChat|Forum|Topic|Member|Administrators|JoinRequest|Boost|Invite|MessageThread|MessageCalendar|MessagePosition|ChatLists|ChatFolder|BlockList|MessageSender|MessageSenders|CanSendMessageToUserResult)/.test(
      returnType
    )
  ) {
    return 'chat_projection';
  }
  if (
    /(Message|Messages|FoundMessages|BusinessMessage|SponsoredMessages|QuickReply|FactCheck|Poll|Reaction|AddedReactions|AvailableReactions|MessageProperties|MessageViewers|MessageReadDate|LinkPreview|FormattedText|TextEntities|TextParseMode|Report|FoundPublicPosts)/.test(
      returnType
    )
  ) {
    return 'message_projection';
  }
  if (
    /(User|Users|Contact|Contacts|CloseBirthday|ProfilePhoto|ProfilePhotos|UserFullInfo|UserLink|Support|Privacy|Audios)/.test(
      returnType
    )
  ) {
    return 'user_projection';
  }
  if (
    /(File|Downloaded|Upload|StorageFileType|RemoteFile|FilePart|FileType|Mime|Extension)/.test(
      returnType
    )
  ) {
    return 'file_projection';
  }
  if (
    /(Story|Stories|ActiveStories|StoryAlbum|StoryAlbums|StoryInteractions|StoryStatistics|StoryInfo)/.test(
      returnType
    )
  ) {
    return 'story_projection';
  }
  if (/(Call|GroupCall|GroupCallInfo)/.test(returnType)) {
    return 'call_projection';
  }
  throw new Error(`Unclassified TDLib function return type: ${func.name}:${returnType}`);
}

function responseRouteForFamily(family) {
  const mapping = {
    account_catalog_or_operation: 'telegram_account_state',
    bot_business_projection: 'telegram_bot_interactions',
    call_projection: 'telegram_calls',
    catalog_projection: 'telegram_catalog_items',
    chat_projection: 'telegram_chats',
    file_projection: 'telegram_files',
    message_projection: 'telegram_messages',
    operation_effect: 'telegram_tdlib_diagnostics',
    story_projection: 'telegram_stories',
    tdlib_diagnostics: 'telegram_tdlib_diagnostics',
    update_dispatch_or_error: 'telegram_procedure_observations',
    user_projection: 'telegram_users'
  };
  return {
    family,
    policy:
      family === 'update_dispatch_or_error' ? STORE_POLICIES.dispatch : STORE_POLICIES.dispatch,
    physicalTable: mapping[family],
    reason:
      family === 'operation_effect'
        ? 'Response contains no Telegram domain object; durable state must arrive through updates or follow-up reads.'
        : family === 'update_dispatch_or_error'
          ? 'Returned updates are dispatched through the update router; errors are normalized into procedure observations.'
          : `Response objects route through ${family} normalizers.`,
    storagePath:
      family === 'update_dispatch_or_error'
        ? 'tdlib_response.dispatch_or_error'
        : `${mapping[family]}.from_response`
  };
}

function classifyDataTypeToPhysicalTable(type, constructorName = '') {
  if (/MessageContent/.test(type)) {
    return 'telegram_message_contents';
  }
  if (/(FormattedText|TextEntity|TextEntities|TextParseMode|LinkPreview)/.test(type)) {
    return 'telegram_message_texts';
  }
  if (
    /(Message|Messages|FoundMessages|BusinessMessage|SponsoredMessages|QuickReply|FactCheck|LinkPreview|FormattedText|TextEntities|TextParseMode|MessageProperties|MessageViewers|MessageReadDate|Report)/.test(
      type
    ) ||
    /^message/.test(constructorName)
  ) {
    return 'telegram_messages';
  }
  if (
    /(Chat|BasicGroup|Supergroup|SecretChat|Forum|Topic|Member|Invite|Boost|BlockList)/.test(type)
  ) {
    return 'telegram_chats';
  }
  if (/(User|Contact|ProfilePhoto|Privacy|Birthdate|Birthday|Support)/.test(type)) {
    return 'telegram_users';
  }
  if (/(File|RemoteFile|LocalFile|Downloaded|Upload|Mime|Extension)/.test(type)) {
    return 'telegram_files';
  }
  if (
    /(Photo|Video|Audio|Document|VoiceNote|VideoNote|Sticker|Animation|PaidMedia|Thumbnail|Minithumbnail)/.test(
      type
    )
  ) {
    return 'telegram_message_media';
  }
  if (/(Reaction|EmojiReaction)/.test(type)) {
    return 'telegram_reactions';
  }
  if (/Poll/.test(type)) {
    return 'telegram_polls';
  }
  if (/Story/.test(type)) {
    return 'telegram_stories';
  }
  if (/Call|GroupCall/.test(type)) {
    return 'telegram_calls';
  }
  if (/Notification/.test(type)) {
    return 'telegram_notifications';
  }
  if (
    /(Authorization|Authentication|EmailAddressAuthentication|PhoneNumberAuthentication|Password|Passkey|Session|Connection|Option|Terms|Suggested|Speed|State|Settings|Log|Network|Proxy|AccountTtl|Autosave|DeviceToken|PushReceiverId)/.test(
      type
    )
  ) {
    return 'telegram_client_state';
  }
  if (
    /(Payment|Invoice|Shipping|Checkout|Gift|Giveaway|Star|Ton|Revenue|Order|Product|Paid|Passport|Identity|Bank|Address|Affiliate)/.test(
      type
    )
  ) {
    return 'telegram_commerce';
  }
  if (
    /(Sticker|Emoji|Animation|Dice|Sound|Background|Theme|Accent|Language|AttachmentMenu|Effect|Composition|Catalog|Hashtag|TimeZones|Country|Countries|Localization|CurrentWeather|WebPageInstantView|Outline)/.test(
      type
    )
  ) {
    return 'telegram_catalog_items';
  }
  if (
    /(Bot|Business|WebApp|Inline|Callback|Query|Custom|Menu|Keyboard|GameHighScores|Rtmp)/.test(
      type
    )
  ) {
    return 'telegram_bot_interactions';
  }
  if (/Test|Error|Ok/.test(type)) {
    return 'telegram_tdlib_diagnostics';
  }
  if (/(Text|Count|Seconds|Can|HttpUrl|JsonValue|Data|PublicPost|FoundPosition)/.test(type)) {
    return 'telegram_catalog_items';
  }
  return 'telegram_catalog_items';
}

function fieldSpecificPhysicalTable(constructor, field, rootPhysicalTable) {
  const fieldType = unwrapVector(field.type);
  const fieldName = field.name;

  if (fieldName === 'content' || fieldType === 'MessageContent') {
    return 'telegram_message_contents';
  }
  if (
    /(text|caption|entities|link_preview)/i.test(fieldName) ||
    /FormattedText|TextEntity|LinkPreview/.test(fieldType)
  ) {
    return 'telegram_message_texts';
  }
  if (
    /(reply|forward|import|origin|thread|topic|story|poll_message|message_thread)/i.test(fieldName)
  ) {
    return fieldName.includes('topic') ? 'telegram_chat_topics' : 'telegram_message_relations';
  }
  if (/(interaction|mention|view|viewer|fact_check|unread|contains_unread)/i.test(fieldName)) {
    return 'telegram_message_interactions';
  }
  if (
    /(send|sending|schedule|scheduling|pin|delete|deleted|live_location|suggested_post|business)/i.test(
      fieldName
    )
  ) {
    return 'telegram_message_state';
  }
  if (/(file|download|upload|remote|local|path)/i.test(fieldName) || /File/.test(fieldType)) {
    return 'telegram_files';
  }
  if (
    /(photo|video|audio|document|voice|sticker|animation|thumbnail|media|paid_media)/i.test(
      fieldName
    ) ||
    /(Photo|Video|Audio|Document|VoiceNote|VideoNote|Sticker|Animation|PaidMedia|Thumbnail|Minithumbnail)/.test(
      fieldType
    )
  ) {
    return 'telegram_message_media';
  }
  if (/reaction/i.test(fieldName) || /Reaction/.test(fieldType)) {
    return 'telegram_reactions';
  }
  if (/poll/i.test(fieldName) || /Poll/.test(fieldType)) {
    return 'telegram_polls';
  }
  if (/story/i.test(fieldName) || /Story/.test(fieldType)) {
    return 'telegram_stories';
  }
  if (/call/i.test(fieldName) || /Call/.test(fieldType)) {
    return 'telegram_calls';
  }
  if (/notification/i.test(fieldName) || /Notification/.test(fieldType)) {
    return 'telegram_notifications';
  }
  if (
    /(payment|invoice|shipping|checkout|gift|giveaway|star|ton|revenue|price|amount|currency|order|paid)/i.test(
      fieldName
    ) ||
    /(Payment|Invoice|Shipping|Checkout|Gift|Giveaway|Star|Ton|Revenue|Order|Paid)/.test(fieldType)
  ) {
    return 'telegram_commerce';
  }
  if (
    /(user|contact|privacy|profile|birthday)/i.test(fieldName) ||
    /(User|Contact|Privacy|Profile|Birthday)/.test(fieldType)
  ) {
    return /(contact|birthday|mutual|close)/i.test(fieldName)
      ? 'telegram_user_relationships'
      : 'telegram_users';
  }
  if (
    /(chat|group|supergroup|secret|member|invite|permission|folder|list|boost)/i.test(fieldName) ||
    /(Chat|Group|Supergroup|Secret|Member|Invite|Permission|Folder|Boost)/.test(fieldType)
  ) {
    return /(member|invite|join|boost)/i.test(fieldName)
      ? 'telegram_chat_members'
      : 'telegram_chats';
  }
  if (
    /(bot|business|web_app|inline|callback|query|keyboard)/i.test(fieldName) ||
    /(Bot|Business|WebApp|Inline|Callback|Query|Keyboard)/.test(fieldType)
  ) {
    return 'telegram_bot_interactions';
  }
  if (
    /(sticker|emoji|background|theme|accent|language|quick_reply|sound|dice|effect|style)/i.test(
      fieldName
    )
  ) {
    return 'telegram_catalog_items';
  }
  return rootPhysicalTable;
}

function storagePolicyForField(field, fieldPhysicalTable, rootPhysicalTable) {
  const unwrappedType = unwrapVector(field.type);
  if (fieldPhysicalTable !== rootPhysicalTable) {
    return {
      policy: STORE_POLICIES.storeEdge,
      reason: 'Field points to another domain aggregate or child projection table.'
    };
  }
  if (isScalarType(unwrappedType) && isHotColumnField(field.name)) {
    return {
      policy: STORE_POLICIES.storeColumn,
      reason: 'Frequently queried scalar field suitable for a typed column.'
    };
  }
  if (!isScalarType(unwrappedType)) {
    return {
      policy: STORE_POLICIES.dispatch,
      reason: 'Nested TDLib object dispatches through its constructor field routes.'
    };
  }
  return {
    policy: STORE_POLICIES.storePayload,
    reason: 'Durable scalar field stored in normalized domain payload.'
  };
}

function storagePathForField(field, physicalTable, policy) {
  if (policy === STORE_POLICIES.storeColumn) {
    return `${physicalTable}.${camelToSnake(field.name)}`;
  }
  if (policy === STORE_POLICIES.storeEdge) {
    return `${physicalTable}.refs.${field.name}`;
  }
  if (policy === STORE_POLICIES.dispatch) {
    return `${physicalTable}.dispatch.${field.name}`;
  }
  return `${physicalTable}.normalized_payload.${field.name}`;
}

function isSensitiveField(constructor, field) {
  return isSensitiveData({
    context: `${constructor.name} ${constructor.resultType} ${field.type}`,
    fieldName: field.name,
    fieldType: field.type
  });
}

function isSensitiveFunctionRequest(func, field) {
  return isSensitiveData({
    context: `${func.name} ${func.resultType} ${field.type}`,
    fieldName: field.name,
    fieldType: field.type
  });
}

function isSensitiveData({ context, fieldName, fieldType }) {
  if (isSensitiveType(fieldType)) {
    return true;
  }
  if (isAlwaysSensitiveName(fieldName)) {
    return true;
  }
  return isContextSensitiveName(fieldName) && isSensitiveContext(context);
}

function isAlwaysSensitiveName(name) {
  return /(password|passkey|api_hash|encryption_key|token|secret|passport|credential|certificate|private|payload|path|local_path|ssn|personal)/i.test(
    name
  );
}

function isContextSensitiveName(name) {
  return /(phone_number|email_address|code|hash|address|bank|card|identity|birthdate)/i.test(name);
}

function isSensitiveContext(context) {
  return /(Authorization|Authentication|Password|Passkey|Passport|Payment|Invoice|Order|Shipping|Bank|Address|Identity|Email|Phone|DeviceToken|Firebase|Credentials?)/i.test(
    context
  );
}

function isSensitiveType(type) {
  return /(Passport|Identity|Bank|Address|Authentication|Password|Passkey|DeviceToken|Email|Phone)/.test(
    type
  );
}

function isRuntimeField(constructor, field, physicalTable) {
  return (
    physicalTable === 'telegram_client_state' ||
    physicalTable === 'telegram_notifications' ||
    /connection|authorization|typing|action|progress|pending|temporary|expires|timeout|duration|ttl|active|online|signal/i.test(
      field.name
    ) ||
    /Signaling|Notification|Temporary|Progress|Pending/.test(field.type) ||
    /^test/.test(constructor.name)
  );
}

function isDiagnosticFunction(func) {
  return /^test/.test(func.name);
}

function isHotColumnField(name) {
  return /^(id|chat_id|message_id|user_id|sender_id|date|edit_date|title|text|first_name|last_name|username|type|is_[a-z0-9_]+|can_[a-z0-9_]+|has_[a-z0-9_]+|count|unread_count|order|position|status)$/.test(
    name
  );
}

function isScalarType(type) {
  return BASIC_TYPES.has(unwrapVector(type));
}

function unwrapVector(type) {
  const match = type.match(/^vector<(.+)>$/);
  return match === null ? type : match[1];
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function resolveProjectionGroupPhysicalTable(logicalProjection) {
  const physicalTable = logicalToPhysical.get(logicalProjection);
  if (physicalTable !== undefined) {
    return physicalTable;
  }
  if (physicalTables.includes(logicalProjection)) {
    return logicalProjection;
  }
  throw new Error(`Projection group has no physical table mapping: ${logicalProjection}`);
}

function validateRoutes(options) {
  const invalid = [
    ...options.objectFieldRoutes.map((route) => route.route.physicalTable),
    ...options.functionRequestFieldRoutes.map((route) => route.route.physicalTable),
    ...options.functionResponseRoutes.map((route) => route.route.physicalTable)
  ].filter((table) => table !== null && table !== undefined && !options.validTables.has(table));

  if (invalid.length > 0) {
    throw new Error(
      `Field routing produced unknown physical tables: ${[...new Set(invalid)].join(', ')}`
    );
  }
}

function renderMarkdown(catalog) {
  const lines = [
    '# TDLib Field Routing Registry',
    '',
    'This file is generated by `node scripts/tdlib-field-routing-generate.mjs`.',
    'Do not edit it by hand.',
    '',
    '## Coverage',
    '',
    `- TDLib schema commit: ${catalog.schema.commit}`,
    `- TDLib schema SHA-256: ${catalog.schema.sha256}`,
    `- Object constructors: ${String(catalog.counts.objectConstructors)}`,
    `- Object fields: ${String(catalog.counts.objectFields)}`,
    `- Functions: ${String(catalog.counts.functions)}`,
    `- Function request fields: ${String(catalog.counts.functionRequestFields)}`,
    `- Function responses: ${String(catalog.counts.functionResponses)}`,
    `- Physical domain tables: ${String(catalog.counts.physicalDomainTables)}`,
    `- Ignored routes: ${String(catalog.counts.ignoredRoutes)}`,
    '',
    '## Policy Counts',
    '',
    '| Policy | Count |',
    '|---|---:|',
    ...Object.entries(catalog.policyCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([policy, count]) => `| \`${policy}\` | ${String(count)} |`),
    '',
    '## Object Constructor Fields',
    '',
    '| Constructor | Result type | Field | TDLib type | Policy | Physical table | Storage path | Policy reason |',
    '|---|---|---|---|---|---|---|---|',
    ...catalog.routes.objectFields.map((route) =>
      [
        route.constructor,
        route.resultType,
        route.field,
        route.fieldType,
        route.route.policy,
        route.route.physicalTable,
        route.route.storagePath,
        route.route.reason
      ]
        .map(markdownCell)
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |')
    ),
    '',
    '## Function Request Fields',
    '',
    '| Method | Response type | Field | TDLib type | Policy | Physical table | Storage path | Policy reason |',
    '|---|---|---|---|---|---|---|---|',
    ...catalog.routes.functionRequestFields.map((route) =>
      [
        route.method,
        route.responseType,
        route.field,
        route.fieldType,
        route.route.policy,
        route.route.physicalTable,
        route.route.storagePath,
        route.route.reason
      ]
        .map(markdownCell)
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |')
    ),
    '',
    '## Function Responses',
    '',
    '| Method | Response type | Policy | Physical table | Storage path | Policy reason |',
    '|---|---|---|---|---|---|',
    ...catalog.routes.functionResponses.map((route) =>
      [
        route.method,
        route.responseType,
        route.route.policy,
        route.route.physicalTable,
        route.route.storagePath,
        route.route.reason
      ]
        .map(markdownCell)
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |')
    ),
    ''
  ];
  return `${lines.join('\n')}`;
}

function markdownCell(value) {
  return `\`${String(value).replaceAll('|', '\\|')}\``;
}

function countBy(values, key) {
  const result = {};
  for (const value of values) {
    const countKey = key(value);
    result[countKey] = (result[countKey] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right))
  );
}
