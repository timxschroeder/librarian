-- Persist the librarian's recommendation slate alongside each assistant message so
-- the cards re-render on refresh. Null for user messages and pure-conversation turns;
-- the most recent non-null slate is the live "table". No new grant needed — a column
-- inherits the table-level privileges already granted in 006_chat_messages.sql.
alter table public.chat_messages add column if not exists slate jsonb;
