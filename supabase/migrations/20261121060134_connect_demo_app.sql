-- Demo access is granted through trusted Supabase Auth app metadata.
-- The underlying shelfpilot schema stays outside the Data API.
create function shelfpilot.is_demo_user()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce(auth.jwt() -> 'app_metadata' -> 'shelfpilot_fixture' = 'true'::jsonb, false);
$$;

revoke all on function shelfpilot.is_demo_user() from public, anon, authenticated;
grant execute on function shelfpilot.is_demo_user() to authenticated;
grant usage on schema shelfpilot to authenticated;
grant select on shelfpilot.books, shelfpilot.publishers, shelfpilot.sources, shelfpilot.book_sources,
  shelfpilot.shelves, shelfpilot.shelf_items, shelfpilot.review_items, shelfpilot.review_candidates to authenticated;
grant update (updated_at) on shelfpilot.shelves to authenticated;
grant insert, delete on shelfpilot.shelf_items to authenticated;
grant insert (book_id) on shelfpilot.store_clicks to authenticated;
grant usage on sequence shelfpilot.store_clicks_click_id_seq to authenticated;

create policy demo_read_books on shelfpilot.books for select to authenticated
  using ((select shelfpilot.is_demo_user()));
create policy demo_read_publishers on shelfpilot.publishers for select to authenticated
  using ((select shelfpilot.is_demo_user()));
create policy demo_read_sources on shelfpilot.sources for select to authenticated
  using ((select shelfpilot.is_demo_user()));
create policy demo_read_book_sources on shelfpilot.book_sources for select to authenticated
  using ((select shelfpilot.is_demo_user()));
create policy demo_read_review_items on shelfpilot.review_items for select to authenticated
  using ((select shelfpilot.is_demo_user()));
create policy demo_read_review_candidates on shelfpilot.review_candidates for select to authenticated
  using ((select shelfpilot.is_demo_user()));
create policy demo_read_own_shelf on shelfpilot.shelves for select to authenticated
  using ((select shelfpilot.is_demo_user()) and user_id = (select auth.uid()));
create policy demo_update_own_shelf on shelfpilot.shelves for update to authenticated
  using ((select shelfpilot.is_demo_user()) and user_id = (select auth.uid()))
  with check ((select shelfpilot.is_demo_user()) and user_id = (select auth.uid()));
create policy demo_read_own_shelf_items on shelfpilot.shelf_items for select to authenticated
  using ((select shelfpilot.is_demo_user()) and user_id = (select auth.uid()));
create policy demo_add_own_shelf_items on shelfpilot.shelf_items for insert to authenticated
  with check ((select shelfpilot.is_demo_user()) and user_id = (select auth.uid()));
create policy demo_remove_own_shelf_items on shelfpilot.shelf_items for delete to authenticated
  using ((select shelfpilot.is_demo_user()) and user_id = (select auth.uid()));
create policy demo_record_store_clicks on shelfpilot.store_clicks for insert to authenticated
  with check ((select shelfpilot.is_demo_user()));

create function public.shelfpilot_demo_catalog()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'books', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(to_jsonb(b) - 'publisher_id' - 'isbn' - 'updated_at')
          || jsonb_build_object(
            'publisher', p.name,
            'sources', coalesce((
              select jsonb_agg(bs.source_id order by s.imported_at, bs.source_id)
              from shelfpilot.book_sources bs
              join shelfpilot.sources s using (source_id)
              where bs.book_id = b.book_id
            ), '[]'::jsonb)
          )
        order by b.book_id
      )
      from shelfpilot.books b join shelfpilot.publishers p using (publisher_id)
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(to_jsonb(s) - 'publisher_id') || jsonb_build_object('publisher', p.name)
        order by s.source_id
      )
      from shelfpilot.sources s join shelfpilot.publishers p using (publisher_id)
    ), '[]'::jsonb),
    'updated_at', coalesce(greatest(
      (select max(updated_at) from shelfpilot.books),
      (select max(imported_at) from shelfpilot.sources)
    ), '1970-01-01 00:00:00+00'::timestamptz)
  )
  where shelfpilot.is_demo_user();
$$;

create function public.shelfpilot_demo_shelf()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'owned', coalesce((
      select jsonb_agg(jsonb_build_object('book_id', i.book_id, 'added_at', i.added_at)
        order by i.added_at, i.book_id)
      from shelfpilot.shelf_items i where i.user_id = s.user_id
    ), '[]'::jsonb),
    'updated_at', s.updated_at
  )
  from shelfpilot.shelves s where s.user_id = auth.uid();
$$;

create function public.shelfpilot_demo_update_shelf(add_ids text[], remove_ids text[])
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  demo_user uuid := auth.uid();
  removed integer;
  added integer;
begin
  if not shelfpilot.is_demo_user() then
    raise insufficient_privilege;
  end if;
  if add_ids is null or remove_ids is null or add_ids && remove_ids or exists (
    select from unnest(add_ids || remove_ids) as requested(id)
    where not exists (select from shelfpilot.books b where b.book_id = requested.id)
  ) then
    raise invalid_parameter_value;
  end if;

  perform 1 from shelfpilot.shelves where user_id = demo_user for update;
  if not found then
    raise no_data_found;
  end if;

  delete from shelfpilot.shelf_items where user_id = demo_user and book_id = any(remove_ids);
  get diagnostics removed = row_count;
  insert into shelfpilot.shelf_items (user_id, book_id)
    select demo_user, id from unnest(add_ids) as requested(id)
    on conflict (user_id, book_id) do nothing;
  get diagnostics added = row_count;

  if removed + added > 0 then
    update shelfpilot.shelves set updated_at = clock_timestamp() where user_id = demo_user;
  end if;
  return public.shelfpilot_demo_shelf();
end;
$$;

create function public.shelfpilot_demo_review_queue()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('items', coalesce((
    select jsonb_agg(
      to_jsonb(r) || jsonb_build_object('candidates', coalesce((
        select jsonb_agg(to_jsonb(c) - 'review_id' order by c.book_id)
        from shelfpilot.review_candidates c where c.review_id = r.review_id
      ), '[]'::jsonb))
      order by r.created_at, r.review_id
    ) from shelfpilot.review_items r
  ), '[]'::jsonb))
  where shelfpilot.is_demo_user();
$$;

create function public.shelfpilot_demo_store_click(clicked_book_id text)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
  if not shelfpilot.is_demo_user() then
    raise insufficient_privilege;
  end if;
  insert into shelfpilot.store_clicks (book_id)
    select b.book_id from shelfpilot.books b
    where b.book_id = clicked_book_id and b.store_url is not null;
  return found;
end;
$$;

revoke all on function public.shelfpilot_demo_catalog(), public.shelfpilot_demo_shelf(),
  public.shelfpilot_demo_update_shelf(text[], text[]), public.shelfpilot_demo_review_queue(),
  public.shelfpilot_demo_store_click(text) from public, anon, authenticated;
grant execute on function public.shelfpilot_demo_catalog(), public.shelfpilot_demo_shelf(),
  public.shelfpilot_demo_update_shelf(text[], text[]), public.shelfpilot_demo_review_queue(),
  public.shelfpilot_demo_store_click(text) to authenticated;
