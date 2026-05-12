# Telegram Type Storage Classification Batch: G Types

## Input Types

1. Game
2. Gift
3. GiftAuction
4. GiftAuctionState
5. GiftBackground
6. GiftChatTheme
7. GiftPurchaseLimits
8. GiftPurchaseOfferState
9. GiftResaleParameters
10. GiftResalePrice
11. GiftSettings
12. GiveawayParameters
13. GiveawayPrize
14. GroupCall
15. GroupCallMessage
16. GroupCallMessageLevel
17. GroupCallParticipant
18. GroupCallParticipantVideoInfo
19. GroupCallRecentSpeaker
20. GroupCallVideoSourceGroup

## Shared Evidence

The batch follows `telegram-type-storage-classification.md` and stores review
results in `tdlib-storage-review.json` as maturity 1 `storage-decision` reviews.

Gift and group-call types split into canonical entities and nested values:
`Gift`, `GiftAuction`, and `GroupCall` have stable identities and procedure
lifecycles, while their background, limit, price, theme, recent speaker, and
video-info values stay embedded. Group-call messages and participants are
owner-scoped facets because their owner key is supplied by update envelopes.

## Decisions

### Game

```text
Type: Game
Storage: embedded
Storage target: MessageContent.game, InlineQueryResult.game
Decision: Game is a message or inline-query payload. game.id is referenced by game-score content, but TDLib score procedures address the owning message or inline message instead of a standalone Game row.
Rejected:
- table: No update or procedure addresses a standalone Game row by game.id.
- extend: It does not extend Message or InlineQueryResult.
- facet: No separate owner-keyed Game record exists.
- pair: There is no key/value companion type.
- kv: Game payloads belong to messages or inline results.
- event: Game messages and inline results are persisted payloads.
Evidence:
- constructors: game(id:int64, short_name:string, title:string, text:formattedText, description:string, photo:photo, animation:animation)
- update use: indirect message update paths carrying MessageContent.game.
- type use: MessageContent.game, InlineQueryResult.game; messageGameScore.game_id references the game payload.
- procedures: getGameHighScores/setGameScore address chat_id/message_id; inline score procedures address inline_message_id; input game procedures use game_short_name.
```

### Gift

```text
Type: Gift
Storage: table
Storage target: id
Decision: Gift is the canonical regular gift catalog entity keyed by gift.id. Available gift lists and gift operations use gift_id, while messages and transactions reference the same gift payload.
Rejected:
- embedded: Gift has a stable id and is reused by catalog, messages, auctions, sent gifts, and transactions.
- extend: It does not extend one owner row.
- facet: gift.id is the entity identity itself.
- pair: There is no key/value companion type.
- kv: Gifts are catalog entities keyed by id.
- event: Gift catalog and gift message state are durable.
Evidence:
- constructors: gift(id:int64, publisher_chat_id:int53, sticker:sticker, star_count:int53, default_sell_star_count:int53, upgrade_star_count:int53, upgrade_variant_count:int32, has_colors:Bool, is_for_birthday:Bool, is_premium:Bool, auction_info:giftAuction, next_send_date:int32, user_limits:giftPurchaseLimits, overall_limits:giftPurchaseLimits, background:giftBackground, first_send_date:int32, last_send_date:int32)
- update use: indirect through GiftAuctionState.gift in auction updates.
- type use: AvailableGift.gift, GiftAuctionState.gift, LinkPreviewType.gift, MessageContent.gift, SentGift.gift, StarTransactionType.gift.
- procedures: getAvailableGifts returns Gift through AvailableGift; canSendGift/sendGift/openGiftAuction/closeGiftAuction/increaseGiftAuctionBid/placeGiftAuctionBid and gift preview/crafting procedures address gift_id.
```

### GiftAuction

```text
Type: GiftAuction
Storage: table
Storage target: id
Decision: GiftAuction is the canonical auction descriptor keyed by GiftAuction.id. It is nested in Gift.auction_info, and getGiftAuctionState addresses mutable auction state by auction_id.
Rejected:
- embedded: Storing it only as opaque Gift.auction_info would lose the addressable auction identity.
- extend: It does not extend Gift.
- facet: GiftAuction.id belongs to the auction descriptor itself.
- pair: There is no key/value companion type.
- kv: Gift auctions are keyed entities.
- event: Auction descriptors and state lookup keys are durable.
Evidence:
- constructors: giftAuction(id:string, gifts_per_round:int32, start_date:int32)
- update use: indirect through GiftAuctionState.gift.auction_info in auction-state updates.
- type use: Gift.auction_info.
- procedures: getGiftAuctionState(auction_id) uses GiftAuction.id; gift auction operations expose auction_info through Gift.
```

### GiftAuctionState

```text
Type: GiftAuctionState
Storage: facet
Storage target: auction_id = GiftAuction.id
Decision: GiftAuctionState is mutable state for an auction. It has no top-level id, but the contained gift carries Gift.auction_info.id, and root updates replace auction state separately from Gift.
Rejected:
- table: The stable key is derived from the owner auction descriptor.
- embedded: Root auction-state updates are independent from Gift owner-field replacement.
- extend: It is not a structural extension of Gift or GiftAuction.
- pair: There is no key/value companion type.
- kv: Auction state belongs to concrete auction ids.
- event: Auction state is current state returned by getGiftAuctionState and active auction updates.
Evidence:
- constructors: giftAuctionState(gift:gift, state:AuctionState)
- update use: updateActiveGiftAuctions.states, updateGiftAuctionState.state.
- type use: no direct owner field outside update/result roots.
- procedures: getGiftAuctionState(auction_id) returns GiftAuctionState; auction mutators address gift_id and update state.
```

### GiftBackground

```text
Type: GiftBackground
Storage: embedded
Storage target: Gift.background
Decision: GiftBackground is a color value nested in Gift.background.
Rejected:
- table: No background id exists.
- extend: It does not extend Gift.
- facet: No separate owner-keyed lifecycle exists.
- pair: There is no key/value companion type.
- kv: The value belongs to Gift rows.
- event: Gift background is durable gift metadata.
Evidence:
- constructors: giftBackground(center_color:int32, edge_color:int32, text_color:int32)
- update use: indirect through Gift.
- type use: Gift.background.
- procedures: gift catalog and gift-returning procedures expose it only through Gift.
```

### GiftChatTheme

```text
Type: GiftChatTheme
Storage: embedded
Storage target: ChatTheme.gift_theme, GiftChatThemes.themes
Decision: GiftChatTheme is a composed theme value built from an upgraded gift and light/dark theme settings. It has no own identity.
Rejected:
- table: No GiftChatTheme id exists.
- extend: It does not extend ChatTheme or UpgradedGift.
- facet: No separate owner-keyed theme lifecycle exists.
- pair: The gift and theme settings are one value object.
- kv: Paginated theme results are not a singleton value.
- event: Gift chat theme data is durable chat/theme state or catalog data.
Evidence:
- constructors: giftChatTheme(gift:upgradedGift, light_settings:themeSettings, dark_settings:themeSettings)
- update use: indirect chat theme updates can carry ChatTheme.gift_theme.
- type use: ChatTheme.gift_theme, GiftChatThemes.themes.
- procedures: getGiftChatThemes returns GiftChatThemes.themes.
```

### GiftPurchaseLimits

```text
Type: GiftPurchaseLimits
Storage: embedded
Storage target: Gift.user_limits, Gift.overall_limits
Decision: GiftPurchaseLimits is a count-pair value nested in Gift.
Rejected:
- table: No limits id exists.
- extend: It does not extend Gift.
- facet: No separate owner-keyed lifecycle exists.
- pair: There is no key/value companion type.
- kv: Limits belong to Gift rows.
- event: Gift purchase limits are current gift metadata.
Evidence:
- constructors: giftPurchaseLimits(total_count:int32, remaining_count:int32)
- update use: indirect through Gift.
- type use: Gift.user_limits, Gift.overall_limits.
- procedures: gift catalog and gift-returning procedures expose it only through Gift.
```

### GiftPurchaseOfferState

```text
Type: GiftPurchaseOfferState
Storage: embedded
Storage target: MessageContent.state
Decision: GiftPurchaseOfferState is an enum-like state value for upgraded gift purchase-offer message content.
Rejected:
- table: No id or payload fields exist.
- extend: It does not extend a message.
- facet: The state is not updated as a separate owner-keyed record.
- pair: There is no key/value companion type.
- kv: The value belongs to a concrete message.
- event: Purchase-offer state is durable message content.
Evidence:
- constructors: giftPurchaseOfferStateAccepted(); giftPurchaseOfferStatePending(); giftPurchaseOfferStateRejected()
- update use: indirect message update paths carrying messageUpgradedGiftPurchaseOffer.state.
- type use: MessageContent.state.
- procedures: processGiftPurchaseOffer(message_id, accept) mutates the offer represented by message content.
```

### GiftResaleParameters

```text
Type: GiftResaleParameters
Storage: embedded
Storage target: UpgradedGift.resale_parameters
Decision: GiftResaleParameters is resale configuration nested in UpgradedGift.
Rejected:
- table: No resale-parameters id exists.
- extend: It does not extend UpgradedGift.
- facet: No separate owner-keyed lifecycle exists.
- pair: There is no key/value companion type.
- kv: The value belongs to concrete upgraded gifts.
- event: Resale parameters are durable upgraded-gift metadata.
Evidence:
- constructors: giftResaleParameters(star_count:int53, toncoin_cent_count:int53, toncoin_only:Bool)
- update use: indirect through UpgradedGift owner paths.
- type use: UpgradedGift.resale_parameters.
- procedures: upgraded-gift and resale procedures expose it through UpgradedGift.
```

### GiftResalePrice

```text
Type: GiftResalePrice
Storage: embedded
Storage target: MessageContent.price, UpgradedGiftOrigin.price, GiftResaleResult.price
Decision: GiftResalePrice is a Stars or TON price value stored in message/origin payloads or returned as a fresh resale result.
Rejected:
- table: No price id exists.
- extend: It does not extend a message, gift, or origin row.
- facet: No separate owner-keyed price lifecycle exists.
- pair: The variant and amount are one value object.
- kv: Prices belong to concrete offers, origins, or results.
- event: Offer and origin prices are durable payload fields.
Evidence:
- constructors: giftResalePriceStar(star_count:int53); giftResalePriceTon(toncoin_cent_count:int53)
- update use: indirect message update paths carrying upgraded gift offer price values.
- type use: MessageContent.price, UpgradedGiftOrigin.price, GiftResaleResult.price.
- procedures: sendGiftPurchaseOffer, sendResoldGift, and setGiftResalePrice accept GiftResalePrice; sendResoldGift can return GiftResaleResult.price.
```

### GiftSettings

```text
Type: GiftSettings
Storage: embedded
Storage target: UserFullInfo.gift_settings
Decision: GiftSettings is stored inside user full info. Setters accept the same value for the current user or business account, but the schema exposes stored state as UserFullInfo.gift_settings.
Rejected:
- table: No GiftSettings id exists.
- extend: It does not extend UserFullInfo or User.
- facet: Stored state is exposed as a user-full-info field rather than a separate settings record.
- pair: There is no key/value companion type.
- kv: Gift settings belong to a user or business-account owner.
- event: Gift settings are durable current settings.
Evidence:
- constructors: giftSettings(show_gift_button:Bool, accepted_gift_types:acceptedGiftTypes)
- update use: indirect user full info paths.
- type use: UserFullInfo.gift_settings.
- procedures: setGiftSettings(settings) and setBusinessAccountGiftSettings(business_connection_id, settings).
```

### GiveawayParameters

```text
Type: GiveawayParameters
Storage: embedded
Storage target: MessageContent.parameters, StorePaymentPurpose.parameters, TelegramPaymentPurpose.parameters
Decision: GiveawayParameters is giveaway configuration inside giveaway message content or payment-purpose payloads.
Rejected:
- table: No giveaway-parameters id exists.
- extend: It does not extend Chat or Message.
- facet: No separate owner-keyed lifecycle exists.
- pair: There is no key/value companion type.
- kv: Parameters belong to concrete giveaway/payment payloads.
- event: Giveaway message parameters are durable message content.
Evidence:
- constructors: giveawayParameters(boosted_chat_id:int53, additional_chat_ids:vector<int53>, winners_selection_date:int32, only_new_members:Bool, has_public_winners:Bool, country_codes:vector<string>, prize_description:string)
- update use: indirect message update paths carrying messageGiveaway.parameters.
- type use: MessageContent.parameters, StorePaymentPurpose.parameters, TelegramPaymentPurpose.parameters.
- procedures: launchPrepaidGiveaway accepts GiveawayParameters as input.
```

### GiveawayPrize

```text
Type: GiveawayPrize
Storage: embedded
Storage target: MessageContent.prize, PrepaidGiveaway.prize, PushMessageContent.prize
Decision: GiveawayPrize is a prize value for giveaway payloads.
Rejected:
- table: No prize id exists.
- extend: It does not extend giveaway owner rows.
- facet: No separate owner-keyed prize lifecycle exists.
- pair: There is no key/value companion type.
- kv: Prize values belong to concrete giveaway payloads.
- event: Giveaway prize data is durable message/prepaid giveaway payload.
Evidence:
- constructors: giveawayPrizePremium(month_count:int32); giveawayPrizeStars(star_count:int53)
- update use: indirect message and push update paths carrying giveaway prize payloads.
- type use: MessageContent.prize, PrepaidGiveaway.prize, PushMessageContent.prize.
- procedures: giveaway-related info/payment/list procedures expose prize values through owner result types.
```

### GroupCall

```text
Type: GroupCall
Storage: table
Storage target: id
Decision: GroupCall is canonical group-call state keyed by groupCall.id. updateGroupCall replaces the row, getGroupCall reads it, and group-call procedures mutate state by group_call_id.
Rejected:
- embedded: GroupCall has a stable id and direct root update/procedure lifecycle.
- extend: It does not extend Chat.
- facet: groupCall.id is the entity identity itself.
- pair: There is no key/value companion type.
- kv: Group calls are entity rows keyed by id.
- event: Group-call state is current state read by getGroupCall and root updates.
Evidence:
- constructors: groupCall(id:int32, unique_id:int64, title:string, invite_link:string, paid_message_star_count:int53, scheduled_start_date:int32, enabled_start_notification:Bool, is_active:Bool, is_video_chat:Bool, is_live_story:Bool, is_rtmp_stream:Bool, is_joined:Bool, need_rejoin:Bool, is_owned:Bool, can_be_managed:Bool, participant_count:int32, has_hidden_listeners:Bool, loaded_all_participants:Bool, message_sender_id:MessageSender, recent_speakers:vector<groupCallRecentSpeaker>, is_my_video_enabled:Bool, is_my_video_paused:Bool, can_enable_video:Bool, mute_new_participants:Bool, can_toggle_mute_new_participants:Bool, can_send_messages:Bool, are_messages_allowed:Bool, can_toggle_are_messages_allowed:Bool, can_delete_messages:Bool, record_duration:int32, is_video_recorded:Bool, duration:int32)
- update use: updateGroupCall.group_call; participant, message, verification, and paid-reaction updates are keyed by group_call_id.
- type use: VideoChat and message video-chat content reference group calls by group_call_id.
- procedures: getGroupCall returns GroupCall; create/join return GroupCallInfo; end/leave/load/revoke/record/screen-share/message/participant procedures mutate by group_call_id.
```

### GroupCallMessage

```text
Type: GroupCallMessage
Storage: facet
Storage target: group_call_id = GroupCall.id, message_id
Decision: GroupCallMessage is a message row inside a group call. message_id is scoped by update envelope group_call_id, and delete/failure updates address the same composite key.
Rejected:
- table: group_call_id is external to the object; message_id alone is scoped to the group call.
- embedded: Messages have add/delete/failure lifecycle independent from replacing GroupCall.
- extend: A group call can have many messages.
- pair: There is no key/value companion type.
- kv: Messages belong to concrete group calls.
- event: Group-call messages have delete/failure lifecycle and are current chat-like state.
Evidence:
- constructors: groupCallMessage(message_id:int32, sender_id:MessageSender, date:int32, text:formattedText, paid_message_star_count:int53, is_from_owner:Bool, can_be_deleted:Bool)
- update use: updateNewGroupCallMessage.message; updateGroupCallMessagesDeleted and updateGroupCallMessageSendFailed mutate by group_call_id/message_id.
- type use: no direct owner field outside update roots.
- procedures: sendGroupCallMessage creates rows; deleteGroupCallMessages and deleteGroupCallMessagesBySender delete scoped rows.
```

### GroupCallMessageLevel

```text
Type: GroupCallMessageLevel
Storage: kv
Storage target: group_call_message_levels
Decision: GroupCallMessageLevel is an account-level catalog of paid group-call message levels. updateGroupCallMessageLevels replaces the root list without an entity owner key.
Rejected:
- table: No level id exists.
- embedded: The type is delivered as a root list update, not as a stored owner field.
- extend: It does not extend GroupCall.
- facet: There is no owner key.
- pair: There is no key/value companion type.
- event: The level list is current configuration useful after restart once loaded.
Evidence:
- constructors: groupCallMessageLevel(min_star_count:int53, pin_duration:int32, max_text_length:int32, max_custom_emoji_count:int32, first_color:int32, second_color:int32, background_color:int32)
- update use: updateGroupCallMessageLevels.levels.
- type use: no direct owner field outside update root.
- procedures: no procedure accepts or returns GroupCallMessageLevel directly.
```

### GroupCallParticipant

```text
Type: GroupCallParticipant
Storage: facet
Storage target: group_call_id = GroupCall.id, participant_id = MessageSender
Decision: GroupCallParticipant is participant state inside a group call. group_call_id is supplied by the update envelope, and participant_id identifies the participant inside that group call.
Rejected:
- table: participant_id is scoped by external group_call_id.
- embedded: Participant updates replace one participant by group_call_id instead of replacing a GroupCall field.
- extend: A group call can have many participants.
- pair: There is no key/value companion type.
- kv: Participants belong to concrete group calls.
- event: Participant state is current group-call state.
Evidence:
- constructors: groupCallParticipant(participant_id:MessageSender, audio_source_id:int32, screen_sharing_audio_source_id:int32, video_info:groupCallParticipantVideoInfo, screen_sharing_video_info:groupCallParticipantVideoInfo, bio:string, is_current_user:Bool, is_speaking:Bool, is_hand_raised:Bool, can_be_muted_for_all_users:Bool, can_be_unmuted_for_all_users:Bool, can_be_muted_for_current_user:Bool, can_be_unmuted_for_current_user:Bool, is_muted_for_all_users:Bool, is_muted_for_current_user:Bool, can_unmute_self:Bool, volume_level:int32, order:string)
- update use: updateGroupCallParticipant.participant; updateGroupCallParticipants changes the loaded participant set for a call.
- type use: nested video-info types under GroupCallParticipant.
- procedures: getLiveStoryStreamer returns GroupCallParticipant; getGroupCallParticipants returns participant ids; participant procedures mutate by group_call_id and participant/user id.
```

### GroupCallParticipantVideoInfo

```text
Type: GroupCallParticipantVideoInfo
Storage: embedded
Storage target: GroupCallParticipant.video_info, GroupCallParticipant.screen_sharing_video_info
Decision: GroupCallParticipantVideoInfo is video state nested inside a group-call participant.
Rejected:
- table: No video-info id exists.
- extend: It does not extend GroupCallParticipant.
- facet: No separate owner-keyed lifecycle exists.
- pair: There is no key/value companion type.
- kv: Video info belongs to concrete participants.
- event: Video info is current participant state.
Evidence:
- constructors: groupCallParticipantVideoInfo(source_groups:vector<groupCallVideoSourceGroup>, endpoint_id:string, is_paused:Bool)
- update use: indirect through updateGroupCallParticipant.participant.
- type use: GroupCallParticipant.video_info, GroupCallParticipant.screen_sharing_video_info.
- procedures: participant-returning procedures expose it only through GroupCallParticipant.
```

### GroupCallRecentSpeaker

```text
Type: GroupCallRecentSpeaker
Storage: embedded
Storage target: GroupCall.recent_speakers
Decision: GroupCallRecentSpeaker is a recent-speaker value in GroupCall.recent_speakers.
Rejected:
- table: No recent-speaker id exists.
- extend: It does not extend GroupCallParticipant.
- facet: No separate recent-speaker lifecycle exists outside GroupCall replacement.
- pair: There is no key/value companion type.
- kv: Recent speakers belong to concrete group calls.
- event: Recent speakers are part of current GroupCall state.
Evidence:
- constructors: groupCallRecentSpeaker(participant_id:MessageSender, is_speaking:Bool)
- update use: updateGroupCall.group_call carries recent speakers.
- type use: GroupCall.recent_speakers.
- procedures: getGroupCall returns GroupCall.recent_speakers.
```

### GroupCallVideoSourceGroup

```text
Type: GroupCallVideoSourceGroup
Storage: embedded
Storage target: GroupCallParticipantVideoInfo.source_groups
Decision: GroupCallVideoSourceGroup is a nested video-source grouping value inside participant video info.
Rejected:
- table: No source-group id exists.
- extend: It does not extend GroupCallParticipantVideoInfo.
- facet: No separate owner-keyed lifecycle exists.
- pair: There is no key/value companion type.
- kv: Source groups belong to concrete participant video info.
- event: Source groups are part of current participant video state.
Evidence:
- constructors: groupCallVideoSourceGroup(semantics:string, source_ids:vector<int32>)
- update use: indirect through updateGroupCallParticipant.participant.
- type use: GroupCallParticipantVideoInfo.source_groups.
- procedures: participant-returning procedures expose it only through GroupCallParticipantVideoInfo.
```

## Batch Review

All 20 G types were completed without introducing a new storage kind.
