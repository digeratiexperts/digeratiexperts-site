-- Flags so the DE Desk transcript purge can skip legal holds and
-- chats linked to a support ticket. The tables themselves are created
-- by the Desk chat store if they are not already present.
ALTER TABLE IF EXISTS de_desk_chat_sessions
  ADD COLUMN IF NOT EXISTS legal_hold boolean DEFAULT false NOT NULL;

ALTER TABLE IF EXISTS de_desk_chat_sessions
  ADD COLUMN IF NOT EXISTS ticket_id text;
