CREATE TABLE "telegram_files" (
  "expected_size" bigint NOT NULL,
  "id" integer NOT NULL,
  "local" jsonb NOT NULL,
  "remote" jsonb NOT NULL,
  "size" bigint,
  CONSTRAINT "telegram_files_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_attachment_menu_bots" (
  "android_icon_file_id" integer,
  "android_side_menu_icon_file_id" integer,
  "bot_user_id" bigint NOT NULL,
  "default_icon_file_id" integer,
  "icon_color" jsonb,
  "ios_animated_icon_file_id" integer,
  "ios_side_menu_icon_file_id" integer,
  "ios_static_icon_file_id" integer,
  "is_added" boolean NOT NULL,
  "macos_icon_file_id" integer,
  "macos_side_menu_icon_file_id" integer,
  "name" text NOT NULL,
  "name_color" jsonb,
  "request_write_access" boolean NOT NULL,
  "show_disclaimer_in_side_menu" boolean NOT NULL,
  "show_in_attachment_menu" boolean NOT NULL,
  "show_in_side_menu" boolean NOT NULL,
  "supports_bot_chats" boolean NOT NULL,
  "supports_channel_chats" boolean NOT NULL,
  "supports_group_chats" boolean NOT NULL,
  "supports_self_chat" boolean NOT NULL,
  "supports_user_chats" boolean NOT NULL,
  "web_app_placeholder_file_id" integer,
  CONSTRAINT "telegram_attachment_menu_bots_pk" PRIMARY KEY ("bot_user_id"),
  CONSTRAINT "telegram_attachment_menu_bots_android_icon_file_id_fk" FOREIGN KEY ("android_icon_file_id") REFERENCES "telegram_files" ("id"),
  CONSTRAINT "telegram_attachment_menu_bots_android_side_menu_icon_file_id_fk" FOREIGN KEY ("android_side_menu_icon_file_id") REFERENCES "telegram_files" ("id"),
  CONSTRAINT "telegram_attachment_menu_bots_default_icon_file_id_fk" FOREIGN KEY ("default_icon_file_id") REFERENCES "telegram_files" ("id"),
  CONSTRAINT "telegram_attachment_menu_bots_ios_animated_icon_file_id_fk" FOREIGN KEY ("ios_animated_icon_file_id") REFERENCES "telegram_files" ("id"),
  CONSTRAINT "telegram_attachment_menu_bots_ios_side_menu_icon_file_id_fk" FOREIGN KEY ("ios_side_menu_icon_file_id") REFERENCES "telegram_files" ("id"),
  CONSTRAINT "telegram_attachment_menu_bots_ios_static_icon_file_id_fk" FOREIGN KEY ("ios_static_icon_file_id") REFERENCES "telegram_files" ("id"),
  CONSTRAINT "telegram_attachment_menu_bots_macos_icon_file_id_fk" FOREIGN KEY ("macos_icon_file_id") REFERENCES "telegram_files" ("id"),
  CONSTRAINT "telegram_attachment_menu_bots_macos_side_menu_icon_file_id_fk" FOREIGN KEY ("macos_side_menu_icon_file_id") REFERENCES "telegram_files" ("id"),
  CONSTRAINT "telegram_attachment_menu_bots_web_app_placeholder_file_id_fk" FOREIGN KEY ("web_app_placeholder_file_id") REFERENCES "telegram_files" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_autosave_settings" (
  "autosave_photos" boolean NOT NULL,
  "autosave_videos" boolean NOT NULL,
  "max_video_file_size" bigint NOT NULL,
  "scope_key" text NOT NULL,
  CONSTRAINT "telegram_autosave_settings_pk" PRIMARY KEY ("scope_key")
);

--> statement-breakpoint

CREATE TABLE "telegram_backgrounds" (
  "document" jsonb,
  "id" bigint NOT NULL,
  "is_dark" boolean NOT NULL,
  "is_default" boolean NOT NULL,
  "name" text NOT NULL,
  "type" jsonb NOT NULL,
  CONSTRAINT "telegram_backgrounds_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_chat_photos" (
  "added_date" timestamp with time zone NOT NULL,
  "animation" jsonb,
  "id" bigint NOT NULL,
  "minithumbnail" jsonb,
  "sizes" jsonb NOT NULL,
  "small_animation" jsonb,
  "sticker" jsonb,
  CONSTRAINT "telegram_chat_photos_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_basic_groups" (
  "bot_commands" jsonb,
  "can_hide_members" boolean,
  "can_toggle_aggressive_anti_spam" boolean,
  "creator_user_id" bigint,
  "description" text,
  "id" bigint NOT NULL,
  "invite_link" jsonb,
  "is_active" boolean,
  "member_count" integer,
  "members" jsonb,
  "photo_id" bigint,
  "status" jsonb,
  "upgraded_to_supergroup_id" bigint,
  CONSTRAINT "telegram_basic_groups_pk" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_basic_groups_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "telegram_chat_photos" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_business_connections" (
  "date" timestamp with time zone NOT NULL,
  "id" text NOT NULL,
  "is_enabled" boolean NOT NULL,
  "rights" jsonb,
  "user_chat_id" bigint NOT NULL,
  "user_id" bigint NOT NULL,
  CONSTRAINT "telegram_business_connections_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_messages" (
  "author_signature" text,
  "auto_delete_in" double precision,
  "can_be_saved" boolean,
  "chat_id" bigint NOT NULL,
  "contains_unread_mention" boolean,
  "contains_unread_poll_votes" boolean,
  "content" jsonb,
  "date" timestamp with time zone,
  "edit_date" timestamp with time zone,
  "effect_id" bigint,
  "fact_check" jsonb,
  "forward_info" jsonb,
  "guest_bot_caller_id" jsonb,
  "has_timestamped_media" boolean,
  "id" bigint NOT NULL,
  "import_info" jsonb,
  "interaction_info" jsonb,
  "is_channel_post" boolean,
  "is_from_offline" boolean,
  "is_outgoing" boolean,
  "is_paid_star_suggested_post" boolean,
  "is_paid_ton_suggested_post" boolean,
  "is_pinned" boolean,
  "media_album_id" bigint,
  "paid_message_star_count" bigint,
  "reply_markup" jsonb,
  "reply_to" jsonb,
  "restriction_info" jsonb,
  "scheduling_state" jsonb,
  "self_destruct_in" double precision,
  "self_destruct_type" jsonb,
  "send_acknowledged" boolean,
  "sender_boost_count" integer,
  "sender_business_bot_user_id" bigint,
  "sender_id" jsonb,
  "sender_tag" text,
  "sending_state" jsonb,
  "suggested_post_info" jsonb,
  "summary_language_code" text,
  "topic_id" jsonb,
  "unread_reactions" jsonb,
  "via_bot_user_id" bigint,
  CONSTRAINT "telegram_messages_pk" PRIMARY KEY ("chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_business_messages" (
  "connection_id" text NOT NULL,
  "message_chat_id" bigint NOT NULL,
  "message_id" bigint NOT NULL,
  "reply_to_message_chat_id" bigint,
  "reply_to_message_id" bigint,
  CONSTRAINT "telegram_business_messages_pk" PRIMARY KEY ("connection_id", "message_chat_id", "message_id"),
  CONSTRAINT "telegram_business_messages_message_fk" FOREIGN KEY ("message_chat_id", "message_id") REFERENCES "telegram_messages" ("chat_id", "id"),
  CONSTRAINT "telegram_business_messages_reply_to_message_fk" FOREIGN KEY ("reply_to_message_chat_id", "reply_to_message_id") REFERENCES "telegram_messages" ("chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_calls" (
  "id" integer NOT NULL,
  "is_outgoing" boolean NOT NULL,
  "is_video" boolean NOT NULL,
  "state" jsonb NOT NULL,
  "unique_id" bigint NOT NULL,
  "user_id" bigint NOT NULL,
  CONSTRAINT "telegram_calls_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_chat_active_stories" (
  "can_be_archived" boolean NOT NULL,
  "chat_id" bigint NOT NULL,
  "list" jsonb,
  "max_read_story_id" integer NOT NULL,
  "order" bigint NOT NULL,
  "stories" jsonb NOT NULL,
  CONSTRAINT "telegram_chat_active_stories_pk" PRIMARY KEY ("chat_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_chat_boosts" (
  "chat_id" bigint NOT NULL,
  "count" integer NOT NULL,
  "expiration_date" timestamp with time zone NOT NULL,
  "id" text NOT NULL,
  "source" jsonb NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  CONSTRAINT "telegram_chat_boosts_pk" PRIMARY KEY ("chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_chat_folder_infos" (
  "color_id" integer NOT NULL,
  "has_my_invite_links" boolean NOT NULL,
  "icon" jsonb NOT NULL,
  "id" integer NOT NULL,
  "is_shareable" boolean NOT NULL,
  "name" jsonb NOT NULL,
  "position" integer NOT NULL,
  CONSTRAINT "telegram_chat_folder_infos_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_chat_invite_links" (
  "chat_id" bigint NOT NULL,
  "creates_join_request" boolean NOT NULL,
  "creator_user_id" bigint NOT NULL,
  "date" timestamp with time zone NOT NULL,
  "edit_date" timestamp with time zone NOT NULL,
  "expiration_date" timestamp with time zone NOT NULL,
  "expired_member_count" integer NOT NULL,
  "invite_link" text NOT NULL,
  "is_primary" boolean NOT NULL,
  "is_revoked" boolean NOT NULL,
  "member_count" integer NOT NULL,
  "member_limit" integer NOT NULL,
  "name" text NOT NULL,
  "pending_join_request_count" integer NOT NULL,
  "subscription_pricing" jsonb,
  CONSTRAINT "telegram_chat_invite_links_pk" PRIMARY KEY ("chat_id", "invite_link")
);

--> statement-breakpoint

CREATE TABLE "telegram_chat_join_requests" (
  "bio" text NOT NULL,
  "chat_id" bigint NOT NULL,
  "date" timestamp with time zone NOT NULL,
  "invite_link" text,
  "user_chat_id" bigint,
  "user_id" bigint NOT NULL,
  CONSTRAINT "telegram_chat_join_requests_pk" PRIMARY KEY ("chat_id", "user_id"),
  CONSTRAINT "telegram_chat_join_requests_invite_link_fk" FOREIGN KEY ("chat_id", "invite_link") REFERENCES "telegram_chat_invite_links" ("chat_id", "invite_link")
);

--> statement-breakpoint

CREATE TABLE "telegram_chat_members" (
  "chat_id" bigint NOT NULL,
  "inviter_user_id" bigint,
  "joined_chat_date" timestamp with time zone NOT NULL,
  "member_id" text NOT NULL,
  "status" jsonb NOT NULL,
  "tag" text NOT NULL,
  CONSTRAINT "telegram_chat_members_pk" PRIMARY KEY ("chat_id", "member_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_chat_positions" (
  "chat_id" bigint NOT NULL,
  "is_pinned" boolean NOT NULL,
  "list_key" text NOT NULL,
  "order" bigint NOT NULL,
  "source" jsonb,
  CONSTRAINT "telegram_chat_positions_pk" PRIMARY KEY ("chat_id", "list_key")
);

--> statement-breakpoint

CREATE TABLE "telegram_chat_revenue_amounts" (
  "available_amount" bigint NOT NULL,
  "balance_amount" bigint NOT NULL,
  "chat_id" bigint NOT NULL,
  "cryptocurrency" text NOT NULL,
  "total_amount" bigint NOT NULL,
  "withdrawal_enabled" boolean NOT NULL,
  CONSTRAINT "telegram_chat_revenue_amounts_pk" PRIMARY KEY ("chat_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_chats" (
  "accent_color_id" integer,
  "action_bar" jsonb,
  "available_reactions" jsonb,
  "background" jsonb,
  "background_custom_emoji_id" bigint,
  "block_list" jsonb,
  "business_bot_manage_bar" jsonb,
  "can_be_deleted_for_all_users" boolean,
  "can_be_deleted_only_for_self" boolean,
  "can_be_reported" boolean,
  "chat_lists" jsonb,
  "client_data" text,
  "default_disable_notification" boolean,
  "draft_message" jsonb,
  "emoji_status" jsonb,
  "has_protected_content" boolean,
  "has_scheduled_messages" boolean,
  "id" bigint NOT NULL,
  "is_marked_as_unread" boolean,
  "is_translatable" boolean,
  "last_message_chat_id" bigint,
  "last_message_id" bigint,
  "last_read_inbox_message_id" bigint,
  "last_read_outbox_message_id" bigint,
  "message_auto_delete_time" integer,
  "message_sender_id" jsonb,
  "notification_settings" jsonb,
  "pending_join_requests" jsonb,
  "permissions" jsonb,
  "photo" jsonb,
  "profile_accent_color_id" integer,
  "profile_background_custom_emoji_id" bigint,
  "reply_markup_message_id" bigint,
  "theme" jsonb,
  "title" text,
  "type" jsonb,
  "unread_count" integer,
  "unread_mention_count" integer,
  "unread_poll_vote_count" integer,
  "unread_reaction_count" integer,
  "upgraded_gift_colors" jsonb,
  "video_chat" jsonb,
  "view_as_topics" boolean,
  CONSTRAINT "telegram_chats_pk" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_chats_last_message_fk" FOREIGN KEY ("last_message_chat_id", "last_message_id") REFERENCES "telegram_messages" ("chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_checklist_tasks" (
  "chat_id" bigint NOT NULL,
  "completed_by" jsonb NOT NULL,
  "completion_date" timestamp with time zone NOT NULL,
  "id" integer NOT NULL,
  "message_id" bigint NOT NULL,
  "text" jsonb NOT NULL,
  CONSTRAINT "telegram_checklist_tasks_pk" PRIMARY KEY ("chat_id", "message_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_close_birthday_users" (
  "birthdate" jsonb NOT NULL,
  "user_id" bigint NOT NULL,
  CONSTRAINT "telegram_close_birthday_users_pk" PRIMARY KEY ("user_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_direct_messages_chat_topics" (
  "can_send_unpaid_messages" boolean NOT NULL,
  "chat_id" bigint NOT NULL,
  "draft_message" jsonb NOT NULL,
  "id" bigint NOT NULL,
  "is_marked_as_unread" boolean NOT NULL,
  "last_message_chat_id" bigint,
  "last_message_id" bigint,
  "last_read_inbox_message_id" bigint NOT NULL,
  "last_read_outbox_message_id" bigint NOT NULL,
  "order" bigint NOT NULL,
  "sender_id" jsonb NOT NULL,
  "unread_count" bigint NOT NULL,
  "unread_reaction_count" bigint NOT NULL,
  CONSTRAINT "telegram_direct_messages_chat_topics_pk" PRIMARY KEY ("chat_id", "id"),
  CONSTRAINT "telegram_direct_messages_chat_topics_last_message_fk" FOREIGN KEY ("last_message_chat_id", "last_message_id") REFERENCES "telegram_messages" ("chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_file_generation_requests" (
  "conversion" text NOT NULL,
  "destination_path" text NOT NULL,
  "generation_id" bigint NOT NULL,
  "original_path" text NOT NULL,
  CONSTRAINT "telegram_file_generation_requests_pk" PRIMARY KEY ("generation_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_file_downloads" (
  "add_date" timestamp with time zone NOT NULL,
  "complete_date" timestamp with time zone NOT NULL,
  "file_id" integer NOT NULL,
  "is_paused" boolean NOT NULL,
  "message_chat_id" bigint NOT NULL,
  "message_id" bigint NOT NULL,
  CONSTRAINT "telegram_file_downloads_pk" PRIMARY KEY ("file_id"),
  CONSTRAINT "telegram_file_downloads_message_fk" FOREIGN KEY ("message_chat_id", "message_id") REFERENCES "telegram_messages" ("chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_forum_topic_infos" (
  "chat_id" bigint NOT NULL,
  "creation_date" timestamp with time zone NOT NULL,
  "creator_id" jsonb NOT NULL,
  "forum_topic_id" integer NOT NULL,
  "icon" jsonb NOT NULL,
  "is_closed" boolean NOT NULL,
  "is_general" boolean NOT NULL,
  "is_hidden" boolean NOT NULL,
  "is_name_implicit" boolean NOT NULL,
  "is_outgoing" boolean NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "telegram_forum_topic_infos_pk" PRIMARY KEY ("chat_id", "forum_topic_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_forum_topics" (
  "chat_id" bigint NOT NULL,
  "draft_message" jsonb,
  "forum_topic_id" integer NOT NULL,
  "is_pinned" boolean,
  "last_message_chat_id" bigint,
  "last_message_id" bigint,
  "last_read_inbox_message_id" bigint,
  "last_read_outbox_message_id" bigint,
  "notification_settings" jsonb,
  "order" bigint,
  "unread_count" integer,
  "unread_mention_count" integer,
  "unread_poll_vote_count" integer,
  "unread_reaction_count" integer,
  CONSTRAINT "telegram_forum_topics_pk" PRIMARY KEY ("chat_id", "forum_topic_id"),
  CONSTRAINT "telegram_forum_topics_last_message_fk" FOREIGN KEY ("last_message_chat_id", "last_message_id") REFERENCES "telegram_messages" ("chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_gift_auctions" (
  "gifts_per_round" integer NOT NULL,
  "id" text NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  CONSTRAINT "telegram_gift_auctions_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_stickers" (
  "emoji" text,
  "file_id" integer NOT NULL,
  "format" jsonb NOT NULL,
  "full_type" jsonb NOT NULL,
  "height" integer NOT NULL,
  "id" bigint,
  "set_id" bigint,
  "thumbnail" jsonb NOT NULL,
  "width" integer NOT NULL,
  CONSTRAINT "telegram_stickers_pk" PRIMARY KEY ("file_id"),
  CONSTRAINT "telegram_stickers_file_fk" FOREIGN KEY ("file_id") REFERENCES "telegram_files" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_gifts" (
  "auction_id" text,
  "background" jsonb NOT NULL,
  "default_sell_star_count" bigint NOT NULL,
  "first_send_date" timestamp with time zone NOT NULL,
  "has_colors" boolean NOT NULL,
  "id" bigint NOT NULL,
  "is_for_birthday" boolean NOT NULL,
  "is_premium" boolean NOT NULL,
  "last_send_date" timestamp with time zone NOT NULL,
  "next_send_date" timestamp with time zone NOT NULL,
  "overall_limits" jsonb NOT NULL,
  "publisher_chat_id" bigint,
  "star_count" bigint NOT NULL,
  "sticker_file_id" integer NOT NULL,
  "upgrade_star_count" bigint NOT NULL,
  "upgrade_variant_count" integer,
  "user_limits" jsonb NOT NULL,
  CONSTRAINT "telegram_gifts_pk" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_gifts_sticker_fk" FOREIGN KEY ("sticker_file_id") REFERENCES "telegram_stickers" ("file_id"),
  CONSTRAINT "telegram_gifts_auction_fk" FOREIGN KEY ("auction_id") REFERENCES "telegram_gift_auctions" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_gift_auction_states" (
  "auction_id" text NOT NULL,
  "gift_id" bigint NOT NULL,
  "state" jsonb NOT NULL,
  CONSTRAINT "telegram_gift_auction_states_pk" PRIMARY KEY ("auction_id"),
  CONSTRAINT "telegram_gift_auction_states_auction_fk" FOREIGN KEY ("auction_id") REFERENCES "telegram_gift_auctions" ("id"),
  CONSTRAINT "telegram_gift_auction_states_gift_fk" FOREIGN KEY ("gift_id") REFERENCES "telegram_gifts" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_group_call_encrypted_participant_users" (
  "group_call_id" integer NOT NULL,
  "participant_user_ids" jsonb NOT NULL,
  CONSTRAINT "telegram_group_call_encrypted_participant_users_pk" PRIMARY KEY ("group_call_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_group_call_messages" (
  "can_be_deleted" boolean,
  "date" timestamp with time zone,
  "error" jsonb,
  "group_call_id" integer NOT NULL,
  "is_from_owner" boolean,
  "message_id" integer NOT NULL,
  "paid_message_star_count" bigint,
  "sender_id" jsonb,
  "text" jsonb,
  CONSTRAINT "telegram_group_call_messages_pk" PRIMARY KEY ("group_call_id", "message_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_group_call_participants" (
  "audio_source_id" integer NOT NULL,
  "bio" text NOT NULL,
  "can_be_muted_for_all_users" boolean NOT NULL,
  "can_be_muted_for_current_user" boolean NOT NULL,
  "can_be_unmuted_for_all_users" boolean NOT NULL,
  "can_be_unmuted_for_current_user" boolean NOT NULL,
  "can_unmute_self" boolean NOT NULL,
  "group_call_id" integer NOT NULL,
  "is_current_user" boolean NOT NULL,
  "is_hand_raised" boolean NOT NULL,
  "is_muted_for_all_users" boolean NOT NULL,
  "is_muted_for_current_user" boolean NOT NULL,
  "is_speaking" boolean NOT NULL,
  "order" text NOT NULL,
  "participant_id" text NOT NULL,
  "screen_sharing_audio_source_id" integer NOT NULL,
  "screen_sharing_video_info" jsonb,
  "video_info" jsonb,
  "volume_level" integer NOT NULL,
  CONSTRAINT "telegram_group_call_participants_pk" PRIMARY KEY ("group_call_id", "participant_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_group_call_verification_states" (
  "emojis" jsonb NOT NULL,
  "generation" integer NOT NULL,
  "group_call_id" integer NOT NULL,
  CONSTRAINT "telegram_group_call_verification_states_pk" PRIMARY KEY ("group_call_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_group_calls" (
  "are_messages_allowed" boolean NOT NULL,
  "can_be_managed" boolean NOT NULL,
  "can_delete_messages" boolean NOT NULL,
  "can_enable_video" boolean NOT NULL,
  "can_send_messages" boolean NOT NULL,
  "can_toggle_are_messages_allowed" boolean NOT NULL,
  "can_toggle_mute_new_participants" boolean NOT NULL,
  "duration" integer NOT NULL,
  "enabled_start_notification" boolean NOT NULL,
  "has_hidden_listeners" boolean NOT NULL,
  "id" integer NOT NULL,
  "invite_link" text NOT NULL,
  "is_active" boolean NOT NULL,
  "is_joined" boolean NOT NULL,
  "is_live_story" boolean NOT NULL,
  "is_my_video_enabled" boolean NOT NULL,
  "is_my_video_paused" boolean NOT NULL,
  "is_owned" boolean NOT NULL,
  "is_rtmp_stream" boolean NOT NULL,
  "is_video_chat" boolean NOT NULL,
  "is_video_recorded" boolean NOT NULL,
  "loaded_all_participants" boolean NOT NULL,
  "message_sender_id" jsonb,
  "mute_new_participants" boolean NOT NULL,
  "need_rejoin" boolean NOT NULL,
  "paid_message_star_count" bigint NOT NULL,
  "participant_count" integer NOT NULL,
  "recent_speakers" jsonb NOT NULL,
  "record_duration" integer,
  "scheduled_start_date" timestamp with time zone NOT NULL,
  "title" text NOT NULL,
  "unique_id" bigint NOT NULL,
  CONSTRAINT "telegram_group_calls_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_active_live_location_messages" (
  "chat_id" bigint NOT NULL,
  "message_id" bigint NOT NULL,
  CONSTRAINT "telegram_active_live_location_messages_pk" PRIMARY KEY ("chat_id", "message_id"),
  CONSTRAINT "telegram_active_live_location_messages_message_fk" FOREIGN KEY ("chat_id", "message_id") REFERENCES "telegram_messages" ("chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_kv" (
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  CONSTRAINT "telegram_kv_pk" PRIMARY KEY ("key")
);

--> statement-breakpoint

CREATE TABLE "telegram_language_pack_strings" (
  "key" text NOT NULL,
  "language_pack_id" text NOT NULL,
  "localization_target" text NOT NULL,
  "value" jsonb,
  CONSTRAINT "telegram_language_pack_strings_pk" PRIMARY KEY ("localization_target", "language_pack_id", "key")
);

--> statement-breakpoint

CREATE TABLE "telegram_live_story_donors" (
  "group_call_id" integer NOT NULL,
  "top_donors" jsonb NOT NULL,
  "total_star_count" bigint NOT NULL,
  CONSTRAINT "telegram_live_story_donors_pk" PRIMARY KEY ("group_call_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_managed_bots" (
  "bot_user_id" bigint NOT NULL,
  "creator_user_id" bigint NOT NULL,
  CONSTRAINT "telegram_managed_bots_pk" PRIMARY KEY ("bot_user_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_message_reactions" (
  "chat_id" bigint NOT NULL,
  "is_chosen" boolean NOT NULL,
  "message_id" bigint NOT NULL,
  "reaction_type" text NOT NULL,
  "recent_sender_ids" jsonb NOT NULL,
  "total_count" integer NOT NULL,
  "used_sender_id" jsonb,
  CONSTRAINT "telegram_message_reactions_pk" PRIMARY KEY ("chat_id", "message_id", "reaction_type")
);

--> statement-breakpoint

CREATE TABLE "telegram_active_notification_groups" (
  "chat_id" bigint NOT NULL,
  "id" integer NOT NULL,
  "notification_settings_chat_id" bigint,
  "notification_sound_id" bigint,
  "total_count" integer NOT NULL,
  "type" text NOT NULL,
  CONSTRAINT "telegram_active_notification_groups_pk" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_active_notification_groups_chat_fk" FOREIGN KEY ("chat_id") REFERENCES "telegram_chats" ("id"),
  CONSTRAINT "telegram_active_notification_groups_notification_settings_chat_fk" FOREIGN KEY ("notification_settings_chat_id") REFERENCES "telegram_chats" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_notification_settings" (
  "disable_mention_notifications" boolean NOT NULL,
  "disable_pinned_message_notifications" boolean NOT NULL,
  "mute_for" integer NOT NULL,
  "mute_stories" boolean NOT NULL,
  "scope_key" text NOT NULL,
  "show_preview" boolean NOT NULL,
  "show_story_poster" boolean NOT NULL,
  "sound_id" bigint NOT NULL,
  "story_sound_id" bigint NOT NULL,
  "use_default_mute_stories" boolean NOT NULL,
  CONSTRAINT "telegram_notification_settings_pk" PRIMARY KEY ("scope_key")
);

--> statement-breakpoint

CREATE TABLE "telegram_active_notifications" (
  "call_id" integer,
  "date" timestamp with time zone NOT NULL,
  "group_id" integer NOT NULL,
  "id" integer NOT NULL,
  "is_silent" boolean NOT NULL,
  "message_chat_id" bigint,
  "message_id" bigint,
  "push_content" jsonb,
  "push_is_outgoing" boolean,
  "push_message_id" bigint,
  "push_sender_id" jsonb,
  "push_sender_name" text,
  "show_preview" boolean,
  "type" text NOT NULL,
  CONSTRAINT "telegram_active_notifications_pk" PRIMARY KEY ("group_id", "id"),
  CONSTRAINT "telegram_active_notifications_group_fk" FOREIGN KEY ("group_id") REFERENCES "telegram_active_notification_groups" ("id"),
  CONSTRAINT "telegram_active_notifications_message_fk" FOREIGN KEY ("message_chat_id", "message_id") REFERENCES "telegram_messages" ("chat_id", "id"),
  CONSTRAINT "telegram_active_notifications_call_fk" FOREIGN KEY ("call_id") REFERENCES "telegram_calls" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_polls" (
  "allows_multiple_answers" boolean NOT NULL,
  "allows_revoting" boolean NOT NULL,
  "can_get_voters" boolean NOT NULL,
  "close_date" timestamp with time zone NOT NULL,
  "country_codes" jsonb NOT NULL,
  "id" bigint NOT NULL,
  "is_anonymous" boolean NOT NULL,
  "is_closed" boolean NOT NULL,
  "members_only" boolean NOT NULL,
  "open_period" integer NOT NULL,
  "option_order" jsonb NOT NULL,
  "options" jsonb NOT NULL,
  "question" jsonb NOT NULL,
  "recent_voter_ids" jsonb NOT NULL,
  "total_voter_count" integer NOT NULL,
  "type" jsonb NOT NULL,
  "vote_restriction_reason" jsonb NOT NULL,
  CONSTRAINT "telegram_polls_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_poll_options" (
  "addition_date" timestamp with time zone NOT NULL,
  "author" jsonb NOT NULL,
  "id" text NOT NULL,
  "is_being_chosen" boolean NOT NULL,
  "is_chosen" boolean NOT NULL,
  "media" jsonb NOT NULL,
  "option_position" integer NOT NULL,
  "poll_id" bigint NOT NULL,
  "recent_voter_ids" jsonb NOT NULL,
  "text" jsonb NOT NULL,
  "vote_percentage" integer NOT NULL,
  "voter_count" integer NOT NULL,
  CONSTRAINT "telegram_poll_options_pk" PRIMARY KEY ("poll_id", "option_position"),
  CONSTRAINT "telegram_poll_options_poll_fk" FOREIGN KEY ("poll_id") REFERENCES "telegram_polls" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_poll_answer_options" (
  "option_id" text NOT NULL,
  "option_position" integer NOT NULL,
  "poll_id" bigint NOT NULL,
  "voter_id" text NOT NULL,
  CONSTRAINT "telegram_poll_answer_options_pk" PRIMARY KEY ("poll_id", "voter_id", "option_position")
);

--> statement-breakpoint

CREATE TABLE "telegram_profile_photos" (
  "big_file_id" integer NOT NULL,
  "has_animation" boolean NOT NULL,
  "id" bigint NOT NULL,
  "is_personal" boolean NOT NULL,
  "minithumbnail" jsonb NOT NULL,
  "small_file_id" integer NOT NULL,
  CONSTRAINT "telegram_profile_photos_pk" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_profile_photos_small_file_fk" FOREIGN KEY ("small_file_id") REFERENCES "telegram_files" ("id"),
  CONSTRAINT "telegram_profile_photos_big_file_fk" FOREIGN KEY ("big_file_id") REFERENCES "telegram_files" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_quick_reply_messages" (
  "can_be_edited" boolean NOT NULL,
  "content" jsonb NOT NULL,
  "id" bigint NOT NULL,
  "media_album_id" bigint,
  "order" integer NOT NULL,
  "reply_markup" jsonb NOT NULL,
  "reply_to_message_id" bigint,
  "sending_state" jsonb NOT NULL,
  "shortcut_id" integer NOT NULL,
  "via_bot_user_id" bigint NOT NULL,
  CONSTRAINT "telegram_quick_reply_messages_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_quick_reply_shortcuts" (
  "first_message_id" bigint NOT NULL,
  "id" integer NOT NULL,
  "message_count" integer NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "telegram_quick_reply_shortcuts_pk" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_quick_reply_shortcuts_first_message_fk" FOREIGN KEY ("first_message_id") REFERENCES "telegram_quick_reply_messages" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_saved_messages_tags" (
  "count" integer NOT NULL,
  "label" text NOT NULL,
  "saved_messages_topic_id" bigint NOT NULL,
  "tag" text NOT NULL,
  CONSTRAINT "telegram_saved_messages_tags_pk" PRIMARY KEY ("saved_messages_topic_id", "tag")
);

--> statement-breakpoint

CREATE TABLE "telegram_saved_messages_topics" (
  "draft_message" jsonb,
  "id" bigint NOT NULL,
  "is_pinned" boolean NOT NULL,
  "last_message_chat_id" bigint,
  "last_message_id" bigint,
  "order" bigint NOT NULL,
  "type" jsonb NOT NULL,
  CONSTRAINT "telegram_saved_messages_topics_pk" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_saved_messages_topics_last_message_fk" FOREIGN KEY ("last_message_chat_id", "last_message_id") REFERENCES "telegram_messages" ("chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_secret_chats" (
  "id" integer NOT NULL,
  "is_outbound" boolean NOT NULL,
  "key_hash" bytea NOT NULL,
  "layer" integer NOT NULL,
  "state" jsonb NOT NULL,
  "user_id" bigint NOT NULL,
  CONSTRAINT "telegram_secret_chats_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_star_revenue_statuses" (
  "available_amount" jsonb NOT NULL,
  "current_amount" jsonb NOT NULL,
  "next_withdrawal_in" integer NOT NULL,
  "owner_id" text NOT NULL,
  "total_amount" jsonb NOT NULL,
  "withdrawal_enabled" boolean NOT NULL,
  CONSTRAINT "telegram_star_revenue_statuses_pk" PRIMARY KEY ("owner_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_sticker_sets" (
  "emojis" jsonb NOT NULL,
  "id" bigint NOT NULL,
  "is_allowed_as_chat_emoji_status" boolean NOT NULL,
  "is_archived" boolean NOT NULL,
  "is_installed" boolean NOT NULL,
  "is_official" boolean NOT NULL,
  "is_owned" boolean NOT NULL,
  "is_viewed" boolean NOT NULL,
  "name" text NOT NULL,
  "needs_repainting" boolean NOT NULL,
  "sticker_type" jsonb NOT NULL,
  "stickers" jsonb NOT NULL,
  "thumbnail" jsonb NOT NULL,
  "thumbnail_outline" jsonb NOT NULL,
  "title" text NOT NULL,
  CONSTRAINT "telegram_sticker_sets_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_stories" (
  "album_ids" jsonb NOT NULL,
  "areas" jsonb NOT NULL,
  "can_be_added_to_album" boolean NOT NULL,
  "can_be_deleted" boolean NOT NULL,
  "can_be_edited" boolean NOT NULL,
  "can_be_forwarded" boolean NOT NULL,
  "can_be_replied" boolean NOT NULL,
  "can_get_interactions" boolean NOT NULL,
  "can_get_statistics" boolean NOT NULL,
  "can_post_story_result" jsonb,
  "can_set_privacy_settings" boolean NOT NULL,
  "can_toggle_is_posted_to_chat_page" boolean NOT NULL,
  "caption" jsonb NOT NULL,
  "chosen_reaction_type" jsonb NOT NULL,
  "content" jsonb NOT NULL,
  "date" timestamp with time zone NOT NULL,
  "error" jsonb,
  "has_expired_viewers" boolean NOT NULL,
  "id" integer NOT NULL,
  "interaction_info" jsonb NOT NULL,
  "is_being_edited" boolean NOT NULL,
  "is_being_posted" boolean NOT NULL,
  "is_edited" boolean NOT NULL,
  "is_posted_to_chat_page" boolean NOT NULL,
  "is_visible_only_for_self" boolean NOT NULL,
  "poster_chat_id" bigint NOT NULL,
  "poster_id" jsonb NOT NULL,
  "privacy_settings" jsonb NOT NULL,
  "repost_info" jsonb NOT NULL,
  CONSTRAINT "telegram_stories_pk" PRIMARY KEY ("poster_chat_id", "id")
);

--> statement-breakpoint

CREATE TABLE "telegram_suggested_actions" (
  "action_key" text NOT NULL,
  "authorization_delay" integer,
  "can_be_hidden" boolean,
  "description" jsonb,
  "manage_premium_subscription_url" text,
  "name" text,
  "supergroup_id" bigint,
  "title" jsonb,
  "url" text,
  CONSTRAINT "telegram_suggested_actions_pk" PRIMARY KEY ("action_key")
);

--> statement-breakpoint

CREATE TABLE "telegram_supergroups" (
  "active_story_state" jsonb,
  "administrator_count" integer,
  "banned_count" integer,
  "boost_level" integer NOT NULL,
  "bot_commands" jsonb,
  "bot_verification" jsonb,
  "can_enable_paid_messages" boolean,
  "can_enable_paid_reaction" boolean,
  "can_get_members" boolean,
  "can_get_revenue_statistics" boolean,
  "can_get_star_revenue_statistics" boolean,
  "can_get_statistics" boolean,
  "can_have_sponsored_messages" boolean,
  "can_hide_members" boolean,
  "can_send_gift" boolean,
  "can_set_location" boolean,
  "can_set_sticker_set" boolean,
  "can_toggle_aggressive_anti_spam" boolean,
  "custom_emoji_sticker_set_id" bigint,
  "date" timestamp with time zone NOT NULL,
  "description" text,
  "direct_messages_chat_id" bigint,
  "gift_count" integer,
  "has_aggressive_anti_spam_enabled" boolean,
  "has_automatic_translation" boolean NOT NULL,
  "has_direct_messages_group" boolean NOT NULL,
  "has_forum_tabs" boolean NOT NULL,
  "has_hidden_members" boolean,
  "has_linked_chat" boolean NOT NULL,
  "has_location" boolean NOT NULL,
  "has_paid_media_allowed" boolean,
  "has_pinned_stories" boolean,
  "id" bigint NOT NULL,
  "invite_link" jsonb,
  "is_administered_direct_messages_group" boolean NOT NULL,
  "is_all_history_available" boolean,
  "is_broadcast_group" boolean NOT NULL,
  "is_channel" boolean NOT NULL,
  "is_direct_messages_group" boolean NOT NULL,
  "is_forum" boolean NOT NULL,
  "is_slow_mode_enabled" boolean NOT NULL,
  "join_by_request" boolean NOT NULL,
  "join_to_send_messages" boolean NOT NULL,
  "linked_chat_id" bigint,
  "location" jsonb,
  "main_profile_tab" jsonb,
  "member_count" integer,
  "my_boost_count" integer,
  "outgoing_paid_message_star_count" bigint,
  "paid_message_star_count" bigint NOT NULL,
  "photo_id" bigint,
  "restricted_count" integer,
  "restriction_info" jsonb,
  "show_message_sender" boolean NOT NULL,
  "sign_messages" boolean NOT NULL,
  "slow_mode_delay" integer,
  "slow_mode_delay_expires_in" double precision,
  "status" jsonb NOT NULL,
  "sticker_set_id" bigint,
  "unrestrict_boost_count" integer,
  "upgraded_from_basic_group_id" bigint,
  "upgraded_from_max_message_id" bigint,
  "usernames" jsonb,
  "verification_status" jsonb,
  CONSTRAINT "telegram_supergroups_pk" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_supergroups_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "telegram_chat_photos" ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_terms_of_service" (
  "min_user_age" integer NOT NULL,
  "show_popup" boolean NOT NULL,
  "terms_of_service_id" text NOT NULL,
  "text" jsonb NOT NULL,
  CONSTRAINT "telegram_terms_of_service_pk" PRIMARY KEY ("terms_of_service_id")
);

--> statement-breakpoint

CREATE TABLE "telegram_text_composition_styles" (
  "creator_user_id" bigint,
  "custom_emoji_id" bigint,
  "english_example" jsonb,
  "install_count" integer,
  "is_creator" boolean NOT NULL,
  "is_custom" boolean NOT NULL,
  "name" text NOT NULL,
  "prompt" text,
  "title" text NOT NULL,
  CONSTRAINT "telegram_text_composition_styles_pk" PRIMARY KEY ("name")
);

--> statement-breakpoint

CREATE TABLE "telegram_upgraded_gifts" (
  "backdrop" jsonb NOT NULL,
  "can_send_purchase_offer" boolean NOT NULL,
  "colors" jsonb NOT NULL,
  "craft_probability_per_mille" integer NOT NULL,
  "gift_address" text,
  "host_id" jsonb NOT NULL,
  "id" bigint NOT NULL,
  "is_burned" boolean NOT NULL,
  "is_crafted" boolean NOT NULL,
  "is_premium" boolean NOT NULL,
  "is_theme_available" boolean NOT NULL,
  "max_upgraded_count" integer NOT NULL,
  "model" jsonb NOT NULL,
  "name" text NOT NULL,
  "number" integer NOT NULL,
  "original_details" jsonb NOT NULL,
  "owner_address" text,
  "owner_id" jsonb NOT NULL,
  "owner_name" text NOT NULL,
  "publisher_chat_id" bigint,
  "regular_gift_id" bigint NOT NULL,
  "resale_parameters" jsonb NOT NULL,
  "symbol" jsonb NOT NULL,
  "title" text NOT NULL,
  "total_upgraded_count" integer NOT NULL,
  "used_theme_chat_id" bigint,
  "value_amount" bigint NOT NULL,
  "value_currency" text NOT NULL,
  "value_usd_amount" bigint NOT NULL,
  CONSTRAINT "telegram_upgraded_gifts_pk" PRIMARY KEY ("id")
);

--> statement-breakpoint

CREATE TABLE "telegram_user_privacy_setting_rules" (
  "rules" jsonb NOT NULL,
  "setting_key" text NOT NULL,
  CONSTRAINT "telegram_user_privacy_setting_rules_pk" PRIMARY KEY ("setting_key")
);

--> statement-breakpoint

CREATE TABLE "telegram_users" (
  "accent_color_id" integer,
  "active_story_state" jsonb,
  "added_to_attachment_menu" boolean,
  "background_custom_emoji_id" bigint,
  "bio" jsonb,
  "birthdate" jsonb,
  "block_list" jsonb,
  "bot_info" jsonb,
  "bot_verification" jsonb,
  "business_info" jsonb,
  "can_be_called" boolean,
  "emoji_status" jsonb,
  "first_name" text,
  "first_profile_audio" jsonb,
  "gift_count" integer,
  "gift_settings" jsonb,
  "group_in_common_count" integer,
  "has_posted_to_profile_stories" boolean,
  "has_private_calls" boolean,
  "has_private_forwards" boolean,
  "has_restricted_voice_and_video_note_messages" boolean,
  "has_sponsored_messages_enabled" boolean,
  "have_access" boolean,
  "id" bigint NOT NULL,
  "incoming_paid_message_star_count" bigint,
  "is_close_friend" boolean,
  "is_contact" boolean,
  "is_mutual_contact" boolean,
  "is_premium" boolean,
  "is_support" boolean,
  "language_code" text,
  "last_name" text,
  "main_profile_tab" jsonb,
  "need_phone_number_privacy_exception" boolean,
  "note" jsonb,
  "outgoing_paid_message_star_count" bigint,
  "paid_message_star_count" bigint,
  "pending_rating" jsonb,
  "pending_rating_date" timestamp with time zone,
  "personal_chat_id" bigint,
  "personal_photo_id" bigint,
  "phone_number" text,
  "photo_id" bigint,
  "profile_accent_color_id" integer,
  "profile_background_custom_emoji_id" bigint,
  "profile_photo_id" bigint,
  "public_photo_id" bigint,
  "rating" jsonb,
  "restriction_info" jsonb,
  "restricts_new_chats" boolean,
  "set_chat_background" boolean,
  "status" jsonb,
  "supports_video_calls" boolean,
  "type" jsonb,
  "upgraded_gift_colors" jsonb,
  "usernames" jsonb,
  "uses_unofficial_app" boolean,
  "verification_status" jsonb,
  CONSTRAINT "telegram_users_pk" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_users_profile_photo_fk" FOREIGN KEY ("profile_photo_id") REFERENCES "telegram_profile_photos" ("id"),
  CONSTRAINT "telegram_users_personal_photo_id_fk" FOREIGN KEY ("personal_photo_id") REFERENCES "telegram_chat_photos" ("id"),
  CONSTRAINT "telegram_users_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "telegram_chat_photos" ("id"),
  CONSTRAINT "telegram_users_public_photo_id_fk" FOREIGN KEY ("public_photo_id") REFERENCES "telegram_chat_photos" ("id")
);
