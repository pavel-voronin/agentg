import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const DATA_MODEL_PATH = new URL('docs/04-data/data-model.md', ROOT);
const FIELD_ROUTING_CATALOG_PATH = new URL('docs/04-data/tdlib-field-routing.catalog.json', ROOT);
const FIELD_ROUTING_MARKDOWN_PATH = new URL('docs/04-data/tdlib-field-routing.generated.md', ROOT);

const SCHEMA_COMMIT = '49b3bcbb6bfebf2ed44dd9f25102d2e1a94a58c4';
const SCHEMA_URL = `https://raw.githubusercontent.com/tdlib/td/${SCHEMA_COMMIT}/td/generate/scheme/td_api.tl`;
const SCHEMA_SHA256 = '1a0d13cebb0c04a866da3aac55bb6b47b084b4a789877ab019348c5374f4f2d2';
const CONTROL_TABLES = new Set([
  'telegram_procedure_observations',
  'telegram_projection_gaps',
  'telegram_schema_versions'
]);
const FIELD_ROUTE_POLICIES = new Set([
  'derive',
  'dispatch',
  'redact',
  'store_column',
  'store_edge',
  'store_payload',
  'ttl'
]);

const EXPECTED = {
  functionReturnTypes: 279,
  functionRequestFields: 2053,
  functionResponses: 990,
  functions: 990,
  ignoredRoutes: 0,
  logicalProjections: 132,
  messageContentConstructors: 100,
  objectConstructors: 2055,
  objectFields: 4601,
  objectTypes: 713,
  physicalDomainTables: 29,
  updateConstructors: 180
};
const SCHEMA_EXPECTED_KEYS = [
  'functionReturnTypes',
  'functionRequestFields',
  'functionResponses',
  'functions',
  'messageContentConstructors',
  'objectConstructors',
  'objectFields',
  'objectTypes',
  'updateConstructors'
];

const UPDATE_PROJECTIONS = {
  telegram_account_state: [
    'updateUnreadMessageCount',
    'updateUnreadChatCount',
    'updateAutosaveSettings'
  ],
  telegram_bot_interactions: [
    'updateNewInlineQuery',
    'updateNewChosenInlineResult',
    'updateNewGuestQuery',
    'updateNewCallbackQuery',
    'updateNewInlineCallbackQuery',
    'updateNewBusinessCallbackQuery',
    'updateNewShippingQuery',
    'updateNewPreCheckoutQuery',
    'updateNewCustomEvent',
    'updateNewCustomQuery',
    'updatePaidMediaPurchased',
    'updateBusinessConnection',
    'updateManagedBot'
  ],
  telegram_calls: [
    'updateCall',
    'updateGroupCall',
    'updateGroupCallParticipant',
    'updateGroupCallParticipants',
    'updateGroupCallVerificationState',
    'updateNewGroupCallMessage',
    'updateNewGroupCallPaidReaction',
    'updateGroupCallMessageSendFailed',
    'updateGroupCallMessagesDeleted',
    'updateLiveStoryTopDonors',
    'updateNewCallSignalingData',
    'updateGroupCallMessageLevels'
  ],
  telegram_catalog_items: [
    'updateQuickReplyShortcut',
    'updateQuickReplyShortcutDeleted',
    'updateQuickReplyShortcuts',
    'updateQuickReplyShortcutMessages',
    'updateTrustedMiniAppBots',
    'updateStickerSet',
    'updateInstalledStickerSets',
    'updateTrendingStickerSets',
    'updateRecentStickers',
    'updateFavoriteStickers',
    'updateSavedAnimations',
    'updateSavedNotificationSounds',
    'updateDefaultBackground',
    'updateEmojiChatThemes',
    'updateAccentColors',
    'updateProfileAccentColors',
    'updateLanguagePackStrings',
    'updateAttachmentMenuBots',
    'updateWebAppMessageSent',
    'updateAvailableMessageEffects',
    'updateDiceEmojis',
    'updateStakeDiceState',
    'updateAnimatedEmojiMessageClicked',
    'updateAnimationSearchParameters',
    'updateTextCompositionStyles'
  ],
  telegram_chats: [
    'updateNewChat',
    'updateChatTitle',
    'updateChatPhoto',
    'updateChatAccentColors',
    'updateChatPermissions',
    'updateChatLastMessage',
    'updateChatPosition',
    'updateChatAddedToList',
    'updateChatRemovedFromList',
    'updateChatReadInbox',
    'updateChatReadOutbox',
    'updateChatActionBar',
    'updateChatBusinessBotManageBar',
    'updateChatAvailableReactions',
    'updateChatDraftMessage',
    'updateChatEmojiStatus',
    'updateChatMessageSender',
    'updateChatMessageAutoDeleteTime',
    'updateChatNotificationSettings',
    'updateChatPendingJoinRequests',
    'updateChatReplyMarkup',
    'updateChatBackground',
    'updateChatTheme',
    'updateChatUnreadMentionCount',
    'updateChatUnreadReactionCount',
    'updateChatUnreadPollVoteCount',
    'updateChatVideoChat',
    'updateChatDefaultDisableNotification',
    'updateChatHasProtectedContent',
    'updateChatIsTranslatable',
    'updateChatIsMarkedAsUnread',
    'updateChatViewAsTopics',
    'updateChatBlockList',
    'updateChatHasScheduledMessages',
    'updateChatFolders',
    'updateChatOnlineMemberCount',
    'updateSavedMessagesTopic',
    'updateSavedMessagesTopicCount',
    'updateDirectMessagesChatTopic',
    'updateTopicMessageCount',
    'updateForumTopicInfo',
    'updateForumTopic',
    'updateChatAction',
    'updateBasicGroup',
    'updateSupergroup',
    'updateSecretChat',
    'updateBasicGroupFullInfo',
    'updateSupergroupFullInfo',
    'updateSavedMessagesTags',
    'updateChatMember',
    'updateNewChatJoinRequest',
    'updateChatBoost'
  ],
  telegram_client_state: [
    'updateAuthorizationState',
    'updateServiceNotification',
    'updateNewOauthRequest',
    'updateApplicationVerificationRequired',
    'updateApplicationRecaptchaVerificationRequired',
    'updateOption',
    'updateConnectionState',
    'updateFreezeState',
    'updateAgeVerificationParameters',
    'updateTermsOfService',
    'updateUnconfirmedSession',
    'updateSpeechRecognitionTrial',
    'updateSuggestedActions',
    'updateSpeedLimitNotification'
  ],
  telegram_commerce: [
    'updateGiftAuctionState',
    'updateActiveGiftAuctions',
    'updateOwnedStarCount',
    'updateOwnedTonCount',
    'updateChatRevenueAmount',
    'updateStarRevenueStatus',
    'updateTonRevenueStatus'
  ],
  telegram_files: [
    'updateFile',
    'updateFileGenerationStart',
    'updateFileGenerationStop',
    'updateFileDownloads',
    'updateFileAddedToDownloads',
    'updateFileDownload',
    'updateFileRemovedFromDownloads'
  ],
  telegram_messages: [
    'updateNewMessage',
    'updateMessageSendAcknowledged',
    'updateMessageSendSucceeded',
    'updateMessageSendFailed',
    'updateMessageContent',
    'updateMessageEdited',
    'updateMessageIsPinned',
    'updateMessageInteractionInfo',
    'updateMessageContentOpened',
    'updateMessageMentionRead',
    'updateMessageContainsUnreadPollVotes',
    'updateMessageFactCheck',
    'updateMessageSuggestedPostInfo',
    'updateMessageLiveLocationViewed',
    'updateVideoPublished',
    'updateDeleteMessages',
    'updatePendingTextMessage',
    'updateActiveLiveLocationMessages',
    'updateNewBusinessMessage',
    'updateBusinessMessageEdited',
    'updateBusinessMessagesDeleted'
  ],
  telegram_notifications: [
    'updateScopeNotificationSettings',
    'updateReactionNotificationSettings',
    'updateNotification',
    'updateNotificationGroup',
    'updateActiveNotifications',
    'updateHavePendingNotifications'
  ],
  telegram_polls: ['updatePoll', 'updatePollAnswer'],
  telegram_reactions: [
    'updateMessageUnreadReactions',
    'updateMessageReaction',
    'updateMessageReactions',
    'updateActiveEmojiReactions',
    'updateDefaultReactionType',
    'updateDefaultPaidReactionType'
  ],
  telegram_stories: [
    'updateChatActiveStories',
    'updateStory',
    'updateStoryDeleted',
    'updateStoryPostSucceeded',
    'updateStoryPostFailed',
    'updateStoryListChatCount',
    'updateStoryStealthMode'
  ],
  telegram_users: [
    'updateUserStatus',
    'updateUser',
    'updateUserFullInfo',
    'updateUserPrivacySettingRules',
    'updateContactCloseBirthdays'
  ]
};

const FUNCTION_PROJECTION_EXPECTED = {
  account_catalog_or_operation: { methods: 238, returnTypes: 142 },
  bot_business_projection: { methods: 42, returnTypes: 24 },
  call_projection: { methods: 8, returnTypes: 7 },
  catalog_projection: { methods: 43, returnTypes: 18 },
  chat_projection: { methods: 80, returnTypes: 41 },
  file_projection: { methods: 9, returnTypes: 3 },
  message_projection: { methods: 58, returnTypes: 18 },
  operation_effect: { methods: 462, returnTypes: 1 },
  story_projection: { methods: 18, returnTypes: 7 },
  tdlib_diagnostics: { methods: 7, returnTypes: 7 },
  update_dispatch_or_error: { methods: 3, returnTypes: 3 },
  user_projection: { methods: 22, returnTypes: 8 }
};

const schemaText = await fetchSchemaText();
const docText = await readFile(DATA_MODEL_PATH, 'utf8');
const fieldRoutingCatalog = JSON.parse(await readFile(FIELD_ROUTING_CATALOG_PATH, 'utf8'));
const fieldRoutingMarkdown = await readFile(FIELD_ROUTING_MARKDOWN_PATH, 'utf8');
const schemaHash = createHash('sha256').update(schemaText).digest('hex');
assertEqual('schema sha256', schemaHash, SCHEMA_SHA256);

const parsed = parseTdSchema(schemaText);
const stats = schemaStats(parsed);
for (const name of SCHEMA_EXPECTED_KEYS) {
  assertEqual(name, stats[name], EXPECTED[name]);
}

const updateCoverage = coverageByExplicitLists(parsed.updateConstructors, UPDATE_PROJECTIONS);
const functionCoverage = coverageByReturnType(parsed.functions);

assertDocContains(docText, `TDLib schema commit: ${SCHEMA_COMMIT}`);
assertDocContains(docText, `TDLib schema SHA-256:`);
assertDocContains(docText, SCHEMA_SHA256);
assertDocContains(
  docText,
  `Updates: ${String(EXPECTED.updateConstructors)}/${String(EXPECTED.updateConstructors)}`
);
assertDocContains(
  docText,
  `Functions: ${String(EXPECTED.functions)}/${String(EXPECTED.functions)}`
);
assertDocContains(
  docText,
  `MessageContent constructors: ${String(EXPECTED.messageContentConstructors)}/${String(EXPECTED.messageContentConstructors)}`
);
assertDocContains(docText, `npm run tdlib:field-routing:generate`);
assertDocContains(docText, `docs/04-data/tdlib-field-routing.catalog.json`);
assertDocContains(docText, `docs/04-data/tdlib-field-routing.generated.md`);
assertDocContains(docText, `The model has 132 logical Telegram projections.`);
assertDocContains(docText, `The physical schema stores these`);
assertDocContains(docText, `projections in 29 durable domain tables`);
const physicalTables = extractPhysicalTables(docText);
assertEqual('physical domain table count', physicalTables.length, EXPECTED.physicalDomainTables);
const logicalProjectionMapping = extractLogicalProjectionMapping(docText);
assertEqual(
  'logical projection mapping count',
  logicalProjectionMapping.length,
  EXPECTED.logicalProjections
);
assertEqual(
  'logical projection unique count',
  new Set(logicalProjectionMapping.map((row) => row.logical)).size,
  EXPECTED.logicalProjections
);
const physicalTableSet = new Set(physicalTables);
const unknownLogicalTargets = logicalProjectionMapping
  .map((row) => row.physical)
  .filter((physical) => !physicalTableSet.has(physical));
assertEqual('unknown logical projection physical targets', unknownLogicalTargets.length, 0);
assertFieldRoutingCatalog({
  catalog: fieldRoutingCatalog,
  markdown: fieldRoutingMarkdown,
  parsed,
  physicalTables
});
for (const [projection, updates] of Object.entries(updateCoverage)) {
  assertDocContains(docText, `| \`${projection}\` | ${String(updates.length)} |`);
  for (const update of updates) {
    assertDocContains(docText, `\`${update}\``);
  }
}
for (const [projection, expected] of Object.entries(FUNCTION_PROJECTION_EXPECTED)) {
  assertDocContains(
    docText,
    `| \`${projection}\` | ${String(expected.methods)} | ${String(expected.returnTypes)} |`
  );
}

console.log('TDLib data model audit passed');
console.log(
  JSON.stringify(
    {
      fieldRouting: {
        functionRequestFields: fieldRoutingCatalog.counts.functionRequestFields,
        functionResponses: fieldRoutingCatalog.counts.functionResponses,
        ignoredRoutes: fieldRoutingCatalog.counts.ignoredRoutes,
        objectFields: fieldRoutingCatalog.counts.objectFields,
        policyCounts: fieldRoutingCatalog.policyCounts
      },
      functionProjectionGroups: Object.fromEntries(
        Object.entries(functionCoverage).map(([key, value]) => [
          key,
          {
            methods: value.length,
            returnTypes: new Set(value.map((method) => method.returnType)).size
          }
        ])
      ),
      physicalStorage: {
        logicalProjections: logicalProjectionMapping.length,
        physicalDomainTables: physicalTables.length
      },
      schema: stats,
      updateProjectionGroups: Object.fromEntries(
        Object.entries(updateCoverage).map(([key, value]) => [key, value.length])
      )
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
  const constructors = [];
  for (const line of objectPart.split('\n')) {
    const match = line
      .trim()
      .match(/^([A-Za-z][A-Za-z0-9_]*)\b(.*?)=\s*([A-Za-z][A-Za-z0-9_]*)\s*;/);
    if (match !== null) {
      constructors.push({ fields: parseTlFields(match[2]), name: match[1], type: match[3] });
    }
  }

  const functions = [];
  for (const line of functionPart.split('\n')) {
    const match = line.trim().match(/^([a-z][A-Za-z0-9_]*)\b(.*?)=\s*([A-Za-z][A-Za-z0-9_]*)\s*;/);
    if (match !== null) {
      functions.push({ fields: parseTlFields(match[2]), name: match[1], returnType: match[3] });
    }
  }

  return {
    constructors,
    functions,
    messageContentConstructors: constructors
      .filter((constructor) => constructor.type === 'MessageContent')
      .map((constructor) => constructor.name),
    updateConstructors: constructors
      .filter((constructor) => constructor.type === 'Update')
      .map((constructor) => constructor.name)
  };
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

function schemaStats(parsed) {
  return {
    functionReturnTypes: new Set(parsed.functions.map((func) => func.returnType)).size,
    functionRequestFields: parsed.functions.reduce((sum, func) => sum + func.fields.length, 0),
    functionResponses: parsed.functions.length,
    functions: parsed.functions.length,
    messageContentConstructors: parsed.messageContentConstructors.length,
    objectConstructors: parsed.constructors.length,
    objectFields: parsed.constructors.reduce(
      (sum, constructor) => sum + constructor.fields.length,
      0
    ),
    objectTypes: new Set(parsed.constructors.map((constructor) => constructor.type)).size,
    updateConstructors: parsed.updateConstructors.length
  };
}

function coverageByExplicitLists(schemaNames, projectionLists) {
  const assigned = new Map();
  for (const [projection, names] of Object.entries(projectionLists)) {
    for (const name of names) {
      if (assigned.has(name)) {
        throw new Error(
          `TDLib constructor ${name} is assigned twice: ${assigned.get(name)} and ${projection}`
        );
      }
      assigned.set(name, projection);
    }
  }

  const schemaNameSet = new Set(schemaNames);
  const unknown = [...assigned.keys()].filter((name) => !schemaNameSet.has(name));
  if (unknown.length > 0) {
    throw new Error(`Projection lists unknown TDLib constructors: ${unknown.join(', ')}`);
  }

  const missing = schemaNames.filter((name) => !assigned.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing TDLib Update constructors: ${missing.join(', ')}`);
  }

  return Object.fromEntries(
    Object.entries(projectionLists).map(([projection, names]) => [projection, [...names]])
  );
}

function coverageByReturnType(functions) {
  const groups = {};
  const unclassified = [];
  for (const func of functions) {
    const projection = classifyFunctionReturn(func);
    if (projection === null) {
      unclassified.push(`${func.name}:${func.returnType}`);
      continue;
    }
    groups[projection] ??= [];
    groups[projection].push(func);
  }

  if (unclassified.length > 0) {
    throw new Error(`Unclassified TDLib functions: ${unclassified.join(', ')}`);
  }

  for (const [projection, expected] of Object.entries(FUNCTION_PROJECTION_EXPECTED)) {
    const methods = groups[projection] ?? [];
    assertEqual(`${projection} methods`, methods.length, expected.methods);
    assertEqual(
      `${projection} return types`,
      new Set(methods.map((method) => method.returnType)).size,
      expected.returnTypes
    );
  }

  return groups;
}

function assertFieldRoutingCatalog({ catalog, markdown, parsed, physicalTables }) {
  assertEqual('field routing schema commit', catalog.schema.commit, SCHEMA_COMMIT);
  assertEqual('field routing schema sha256', catalog.schema.sha256, SCHEMA_SHA256);

  assertEqual(
    'field routing object constructors',
    catalog.counts.objectConstructors,
    EXPECTED.objectConstructors
  );
  assertEqual('field routing object types', catalog.counts.objectTypes, EXPECTED.objectTypes);
  assertEqual('field routing object fields', catalog.counts.objectFields, EXPECTED.objectFields);
  assertEqual('field routing functions', catalog.counts.functions, EXPECTED.functions);
  assertEqual(
    'field routing function request fields',
    catalog.counts.functionRequestFields,
    EXPECTED.functionRequestFields
  );
  assertEqual(
    'field routing function responses',
    catalog.counts.functionResponses,
    EXPECTED.functionResponses
  );
  assertEqual('field routing ignored routes', catalog.counts.ignoredRoutes, EXPECTED.ignoredRoutes);
  assertEqual(
    'field routing physical table count',
    catalog.counts.physicalDomainTables,
    EXPECTED.physicalDomainTables
  );

  assertFieldRoutingContains(markdown, `- Object fields: ${String(EXPECTED.objectFields)}`);
  assertFieldRoutingContains(
    markdown,
    `- Function request fields: ${String(EXPECTED.functionRequestFields)}`
  );
  assertFieldRoutingContains(
    markdown,
    `- Function responses: ${String(EXPECTED.functionResponses)}`
  );
  assertFieldRoutingContains(markdown, `- Ignored routes: ${String(EXPECTED.ignoredRoutes)}`);

  const schemaObjectFieldKeys = parsed.constructors.flatMap((constructor) =>
    constructor.fields.map((field) => `${constructor.name}.${field.name}`)
  );
  const schemaFunctionRequestFieldKeys = parsed.functions.flatMap((func) =>
    func.fields.map((field) => `${func.name}.${field.name}`)
  );
  const schemaFunctionResponseKeys = parsed.functions.map((func) => func.name);

  const objectRoutes = catalog.routes.objectFields;
  const functionRequestRoutes = catalog.routes.functionRequestFields;
  const functionResponseRoutes = catalog.routes.functionResponses;

  assertSameStringSet(
    'object field routing coverage',
    objectRoutes.map((route) => `${route.constructor}.${route.field}`),
    schemaObjectFieldKeys
  );
  assertSameStringSet(
    'function request field routing coverage',
    functionRequestRoutes.map((route) => `${route.method}.${route.field}`),
    schemaFunctionRequestFieldKeys
  );
  assertSameStringSet(
    'function response routing coverage',
    functionResponseRoutes.map((route) => route.method),
    schemaFunctionResponseKeys
  );

  const validTables = new Set([...physicalTables, ...CONTROL_TABLES]);
  const allRoutes = [...objectRoutes, ...functionRequestRoutes, ...functionResponseRoutes];
  const policyCounts = {};

  for (const route of allRoutes) {
    const routePolicy = route.route?.policy;
    const physicalTable = route.route?.physicalTable;
    const storagePath = route.route?.storagePath;
    const reason = route.route?.reason;

    if (!FIELD_ROUTE_POLICIES.has(routePolicy)) {
      throw new Error(`Unknown field routing policy: ${String(routePolicy)}`);
    }
    if (!validTables.has(physicalTable)) {
      throw new Error(`Unknown field routing physical table: ${String(physicalTable)}`);
    }
    if (typeof storagePath !== 'string' || storagePath.length === 0) {
      throw new Error(`Missing field routing storage path: ${JSON.stringify(route)}`);
    }
    if (typeof reason !== 'string' || reason.length === 0) {
      throw new Error(`Missing field routing policy reason: ${JSON.stringify(route)}`);
    }

    policyCounts[routePolicy] = (policyCounts[routePolicy] ?? 0) + 1;
  }

  assertEqual(
    'field routing policy total',
    Object.values(catalog.policyCounts).reduce((sum, count) => sum + count, 0),
    allRoutes.length
  );
  assertEqual(
    'field routing total route count',
    allRoutes.length,
    EXPECTED.objectFields + EXPECTED.functionRequestFields + EXPECTED.functionResponses
  );
  assertEqual('field routing ignored policy count', catalog.policyCounts.ignore ?? 0, 0);

  for (const [policy, count] of Object.entries(policyCounts)) {
    assertEqual(`field routing policy count ${policy}`, catalog.policyCounts[policy], count);
  }
}

function classifyFunctionReturn(func) {
  const returnType = func.returnType;
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
  return null;
}

function assertDocContains(text, expected) {
  if (!text.includes(expected)) {
    throw new Error(`docs/04-data/data-model.md does not contain required text: ${expected}`);
  }
}

function assertFieldRoutingContains(text, expected) {
  if (!text.includes(expected)) {
    throw new Error(
      `docs/04-data/tdlib-field-routing.generated.md does not contain required text: ${expected}`
    );
  }
}

function assertSameStringSet(name, actualValues, expectedValues) {
  assertEqual(`${name} actual count`, actualValues.length, expectedValues.length);
  assertEqual(`${name} unique actual count`, new Set(actualValues).size, actualValues.length);
  assertEqual(`${name} unique expected count`, new Set(expectedValues).size, expectedValues.length);

  const actual = new Set(actualValues);
  const expected = new Set(expectedValues);
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`${name}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`);
  }
}

function extractPhysicalTables(text) {
  const section = extractSection(text, '## Physical Storage Plan', '## Logical Projection Mapping');
  const tables = [];
  for (const line of section.split('\n')) {
    const match = line.match(/^\| `(telegram_[a-z0-9_]+)` \|/);
    if (match !== null) {
      tables.push(match[1]);
    }
  }
  return [...new Set(tables)].sort();
}

function extractLogicalProjectionMapping(text) {
  const section = extractSection(
    text,
    '## Logical Projection Mapping',
    '## Update Projection Coverage'
  );
  const rows = [];
  for (const line of section.split('\n')) {
    const match = line.match(/^\| `(telegram_[a-z0-9_]+)` \| `(telegram_[a-z0-9_]+)` \|/);
    if (match !== null) {
      rows.push({
        logical: match[1],
        physical: match[2]
      });
    }
  }
  return rows;
}

function extractSection(text, startHeading, endHeading) {
  const startIndex = text.indexOf(startHeading);
  if (startIndex === -1) {
    throw new Error(`Missing section: ${startHeading}`);
  }
  const endIndex = text.indexOf(endHeading, startIndex + startHeading.length);
  if (endIndex === -1) {
    throw new Error(`Missing section end: ${endHeading}`);
  }
  return text.slice(startIndex, endIndex);
}

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
