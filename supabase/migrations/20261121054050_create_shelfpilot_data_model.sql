create schema shelfpilot;
revoke all on schema shelfpilot from public, anon, authenticated;
grant usage on schema shelfpilot to service_role;

-- These labels mirror schemas/common.schema.json.
create type shelfpilot.book_edition as enum ('manga', 'light_novel', 'special_set', 'big_book');

create table shelfpilot.publishers (
    publisher_id text primary key check (btrim(publisher_id) <> ''),
    name text not null unique check (btrim(name) <> ''),
    website_url text
);

create table shelfpilot.series (
    series_id text primary key check (btrim(series_id) <> ''),
    canonical_title text not null check (btrim(canonical_title) <> '')
);

create table shelfpilot.series_titles (
    series_id text not null references shelfpilot.series (series_id) on delete cascade,
    language_code text not null check (language_code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
    title text not null check (btrim(title) <> ''),
    primary key (series_id, language_code, title)
);

create table shelfpilot.books (
    book_id text primary key check (btrim(book_id) <> ''),
    series_id text not null references shelfpilot.series (series_id),
    publisher_id text not null references shelfpilot.publishers (publisher_id),
    title text not null check (btrim(title) <> ''),
    aliases text[] not null default '{}',
    volume numeric not null check (volume >= 0 and volume < 'Infinity'::numeric),
    edition shelfpilot.book_edition not null,
    isbn text check (isbn ~ '^(978|979)[0-9]{10}$'),
    release_date date,
    release_date_precision text not null check (release_date_precision in ('day', 'month')),
    sale_status text not null check (sale_status in ('announced', 'preorder', 'released')),
    store_url text,
    cover_url text,
    updated_at timestamptz not null default now(),
    unique (series_id, edition, volume),
    check (release_date_precision <> 'month' or extract(day from release_date) = 1)
);

create unique index books_isbn_idx on shelfpilot.books (isbn) where isbn is not null;
create index books_publisher_id_idx on shelfpilot.books (publisher_id);

create table shelfpilot.sources (
    source_id text primary key check (btrim(source_id) <> ''),
    publisher_id text not null references shelfpilot.publishers (publisher_id),
    source_url text not null,
    raw_text text not null,
    posted_at timestamptz,
    imported_at timestamptz not null default now()
);

create index sources_publisher_id_idx on shelfpilot.sources (publisher_id);

create table shelfpilot.book_sources (
    book_id text not null references shelfpilot.books (book_id) on delete cascade,
    source_id text not null references shelfpilot.sources (source_id),
    primary key (book_id, source_id)
);

create index book_sources_source_id_idx on shelfpilot.book_sources (source_id);

create table shelfpilot.shelves (
    user_id uuid primary key references auth.users (id) on delete cascade,
    updated_at timestamptz not null default now()
);

create table shelfpilot.shelf_items (
    user_id uuid not null references shelfpilot.shelves (user_id) on delete cascade,
    book_id text not null references shelfpilot.books (book_id),
    added_at timestamptz not null default now(),
    primary key (user_id, book_id)
);

create index shelf_items_book_id_idx on shelfpilot.shelf_items (book_id);

create table shelfpilot.review_items (
    review_id text primary key check (btrim(review_id) <> ''),
    source_id text not null references shelfpilot.sources (source_id),
    extracted jsonb not null check (jsonb_typeof(extracted) = 'object'),
    reason text not null,
    status text not null default 'open' check (status in ('open', 'resolved')),
    created_at timestamptz not null default now()
);

create index review_items_source_id_idx on shelfpilot.review_items (source_id);

create table shelfpilot.review_candidates (
    review_id text not null references shelfpilot.review_items (review_id) on delete cascade,
    book_id text not null references shelfpilot.books (book_id),
    edition shelfpilot.book_edition not null,
    confidence numeric not null check (confidence between 0 and 1),
    primary key (review_id, book_id)
);

create index review_candidates_book_id_idx on shelfpilot.review_candidates (book_id);

create table shelfpilot.store_clicks (
    click_id bigint generated always as identity primary key,
    book_id text not null references shelfpilot.books (book_id),
    clicked_at timestamptz not null default now()
);

create index store_clicks_book_id_idx on shelfpilot.store_clicks (book_id);

-- Keep the data server-side so writes can pass through the app's approval gate.
alter table shelfpilot.publishers enable row level security;
alter table shelfpilot.series enable row level security;
alter table shelfpilot.series_titles enable row level security;
alter table shelfpilot.books enable row level security;
alter table shelfpilot.sources enable row level security;
alter table shelfpilot.book_sources enable row level security;
alter table shelfpilot.shelves enable row level security;
alter table shelfpilot.shelf_items enable row level security;
alter table shelfpilot.review_items enable row level security;
alter table shelfpilot.review_candidates enable row level security;
alter table shelfpilot.store_clicks enable row level security;

revoke all on all tables in schema shelfpilot from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema shelfpilot to service_role;
grant usage on all sequences in schema shelfpilot to service_role;
