-- Supabase ingestion requires an explicit Auth account grant and publishes changes atomically.
alter table shelfpilot.sources alter column publisher_id drop not null;
alter table shelfpilot.sources add column in_catalog boolean not null default true;

create table shelfpilot.ingest_revision (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0
);
alter table shelfpilot.ingest_revision enable row level security;
revoke all on table shelfpilot.ingest_revision from public, anon, authenticated;
insert into shelfpilot.ingest_revision default values;

create function shelfpilot.is_ingest_admin()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select from auth.users u
    where u.id = auth.uid()
      and u.raw_app_meta_data -> 'shelfpilot_admin' = 'true'::jsonb
  );
$$;
revoke all on function shelfpilot.is_ingest_admin() from public, anon, authenticated;

create function shelfpilot.catalog_json()
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
              where bs.book_id = b.book_id and s.in_catalog
            ), '[]'::jsonb)
          )
        order by b.book_id
      )
      from shelfpilot.books b join shelfpilot.publishers p using (publisher_id)
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(to_jsonb(s) - 'publisher_id' - 'in_catalog')
          || jsonb_build_object('publisher', coalesce(p.name, ''))
        order by s.source_id
      )
      from shelfpilot.sources s left join shelfpilot.publishers p using (publisher_id)
      where s.in_catalog
    ), '[]'::jsonb),
    'updated_at', coalesce(greatest(
      (select max(updated_at) from shelfpilot.books),
      (select max(imported_at) from shelfpilot.sources where in_catalog)
    ), '1970-01-01 00:00:00+00'::timestamptz)
  );
$$;

create function shelfpilot.review_queue_json()
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
  ), '[]'::jsonb));
$$;

-- These helpers still apply the invoking role's table permissions and RLS.
revoke all on function shelfpilot.catalog_json(), shelfpilot.review_queue_json() from public, anon, authenticated;
grant execute on function shelfpilot.catalog_json(), shelfpilot.review_queue_json() to authenticated;

create or replace function public.shelfpilot_demo_catalog()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select shelfpilot.catalog_json() where shelfpilot.is_demo_user();
$$;

create or replace function public.shelfpilot_demo_review_queue()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select shelfpilot.review_queue_json() where shelfpilot.is_demo_user();
$$;

create function public.shelfpilot_admin_snapshot()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not shelfpilot.is_ingest_admin() then
    raise insufficient_privilege;
  end if;
  return (
    select jsonb_build_object('revision', revision::text, 'catalog', shelfpilot.catalog_json(),
      'queue', shelfpilot.review_queue_json())
    from shelfpilot.ingest_revision where singleton
  );
end;
$$;

create function shelfpilot.ingest_publisher(publisher_name text)
returns text
language plpgsql security invoker set search_path = ''
as $$
begin
  if nullif(btrim(publisher_name), '') is null then
    return null;
  end if;
  insert into shelfpilot.publishers (publisher_id, name)
    values ('pub_' || md5(publisher_name), publisher_name)
    on conflict (name) do nothing;
  return (select publisher_id from shelfpilot.publishers where name = publisher_name);
end;
$$;

create function shelfpilot.ingest_source(source jsonb, publish boolean)
returns void
language sql security invoker set search_path = ''
as $$
  insert into shelfpilot.sources (source_id, publisher_id, source_url, raw_text, posted_at, imported_at, in_catalog)
    values (source ->> 'source_id', shelfpilot.ingest_publisher(source ->> 'publisher'),
      source ->> 'source_url', source ->> 'raw_text', (source ->> 'posted_at')::timestamptz,
      (source ->> 'imported_at')::timestamptz, publish)
    on conflict (source_id) do update set in_catalog = true
      where excluded.in_catalog and not sources.in_catalog;
$$;
revoke all on function shelfpilot.ingest_publisher(text), shelfpilot.ingest_source(jsonb, boolean)
  from public, anon, authenticated;

create function public.shelfpilot_admin_commit(expected_revision text, books jsonb, sources jsonb, reviews jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  current_revision bigint;
  source jsonb;
  book record;
  review record;
begin
  if not shelfpilot.is_ingest_admin() then
    raise insufficient_privilege;
  end if;
  select revision into strict current_revision from shelfpilot.ingest_revision where singleton for update;
  if current_revision::text is distinct from expected_revision then
    return false;
  end if;
  if jsonb_typeof(books) is distinct from 'array' or jsonb_typeof(sources) is distinct from 'array'
    or jsonb_typeof(reviews) is distinct from 'array' then
    raise invalid_parameter_value;
  end if;

  for source in select value from jsonb_array_elements(sources) loop
    perform shelfpilot.ingest_source(source, true);
  end loop;

  for book in select * from jsonb_to_recordset(books) as b(
    book_id text, series_id text, title text, publisher text, aliases text[], volume numeric,
    edition shelfpilot.book_edition, release_date date, release_date_precision text,
    sale_status text, store_url text, cover_url text, sources text[]
  ) loop
    insert into shelfpilot.series (series_id, canonical_title) values (book.series_id, book.title)
      on conflict (series_id) do nothing;
    insert into shelfpilot.books (book_id, series_id, title, publisher_id, aliases, volume, edition,
      release_date, release_date_precision, sale_status, store_url, cover_url, updated_at)
      values (book.book_id, book.series_id, book.title, shelfpilot.ingest_publisher(book.publisher), book.aliases,
        book.volume, book.edition, book.release_date, book.release_date_precision, book.sale_status,
        book.store_url, book.cover_url, clock_timestamp())
      on conflict (book_id) do update set aliases = excluded.aliases, release_date = excluded.release_date,
        release_date_precision = excluded.release_date_precision, sale_status = excluded.sale_status,
        updated_at = excluded.updated_at;
    insert into shelfpilot.book_sources (book_id, source_id)
      select book.book_id, source_id from unnest(book.sources) as evidence(source_id)
      on conflict (book_id, source_id) do nothing;
  end loop;

  for review in select * from jsonb_to_recordset(reviews) as r(
    review_id text, source_id text, extracted jsonb, candidates jsonb, reason text, status text, created_at timestamptz
  ) loop
    if review.extracted ? 'source' then
      perform shelfpilot.ingest_source(review.extracted -> 'source', false);
    end if;
    insert into shelfpilot.review_items (review_id, source_id, extracted, reason, status, created_at)
      values (review.review_id, review.source_id, review.extracted, review.reason, review.status, review.created_at)
      on conflict (review_id) do update set extracted = excluded.extracted, status = excluded.status;
    delete from shelfpilot.review_candidates c where c.review_id = review.review_id;
    insert into shelfpilot.review_candidates (review_id, book_id, edition, confidence)
      select review.review_id, c.book_id, c.edition, c.confidence
      from jsonb_to_recordset(review.candidates) as c(book_id text, edition shelfpilot.book_edition, confidence numeric);
  end loop;

  update shelfpilot.ingest_revision set revision = current_revision + 1 where singleton;
  return true;
end;
$$;

revoke all on function public.shelfpilot_admin_snapshot(), public.shelfpilot_admin_commit(text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.shelfpilot_admin_snapshot(), public.shelfpilot_admin_commit(text, jsonb, jsonb, jsonb)
  to authenticated;
