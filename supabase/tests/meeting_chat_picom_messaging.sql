begin;
do $$ begin
  if to_regclass('public.meeting_chat_contexts') is null or to_regclass('public.meeting_chat_message_links') is null then raise exception 'meeting chat context/link metadata missing'; end if;
  if to_regclass('public.meeting_messages') is not null or to_regclass('public.meeting_chat_reactions') is not null then raise exception 'duplicate meeting chat subsystem detected'; end if;
  if not has_function_privilege('authenticated','public.get_meeting_chat_context(uuid,uuid)','execute') then raise exception 'meeting chat context RPC unavailable'; end if;
  if not has_function_privilege('authenticated','public.send_meeting_chat_message(uuid,uuid,text,text,uuid,uuid[])','execute') then raise exception 'meeting chat send RPC unavailable'; end if;
  if has_table_privilege('authenticated','public.meeting_chat_contexts','insert') or has_table_privilege('authenticated','public.meeting_chat_message_links','insert') then raise exception 'meeting chat metadata permits direct client mutation'; end if;
end $$;
rollback;
