# ShelfPilot AI data model

The JSON schemas in [schemas/](../schemas/) define the MVP data contract. The [generated TypeScript types](../web/types/generated/index.ts) reflect those schemas.

## Stored records

| Record | Fields and relationships |
|---|---|
| `Catalog` | Contains `books[]`, `sources[]`, and `updated_at`. |
| `Book` | Represents one volume in one edition. Required fields are `book_id`, `series_id`, `title`, `aliases[]`, numeric `volume`, `edition`, `publisher`, `release_date_precision`, `sale_status`, and `sources[]`. Optional fields are `release_date`, `store_url`, and `cover_url`. |
| `Source` | Stores the evidence behind a catalog entry. Required fields are `source_id`, `source_url`, `raw_text`, `publisher`, and `imported_at`. `posted_at` is optional. |
| `UserShelf` | Stores one shelf with `owned[]` and `updated_at`. Each entry records a `book_id` and `added_at`. |
| `ReviewQueue` | Stores `items[]`. Each item records a `review_id`, `source_id`, extracted data, candidate books with edition and confidence, a reason, a status (`open` or `resolved`), and `created_at`. |

Books in the same publication line share a `series_id`. Keep manga and light novel adaptations in separate publication lines so shelf checks compare the right volumes. Publisher names are stored as strings on books and sources. Use the book's `aliases[]` for Thai, Japanese, English, or abbreviated names as available.

Each book carries a list of source IDs. One publisher post can support several volumes, and several posts can support the same volume. The source record preserves the original URL and text. Shelf entries and review candidates refer to books by their stable `book_id`.

## Volume announcements and matching

- A book's `edition` is `manga`, `light_novel`, `special_set`, or `big_book`.
- A book's `sale_status` is `announced`, `preorder`, or `released`. `release_date_precision` is `day` or `month`. When present, `release_date` must be an ISO date (`YYYY-MM-DD`). Preserve any month-only wording in the source text and avoid guessing a day.
- One release post can yield several book candidates. For `duplicate_merged`, append the new source ID to the existing book and update its sale status when supported. For `distinct_edition`, use a separate book ID. For `needs_review`, queue the candidate without changing the catalog.

The [demo source fixtures](demo-data-sources.md) are inputs to extraction and matching. Publisher release posts supply volume updates. Shop listings and retailer references can support matching and identification.

## Supabase development schema

The [initial migration](../supabase/migrations/20261121054050_create_shelfpilot_data_model.sql) defines persistent storage in the private `shelfpilot` Postgres schema. The JSON contracts above still describe the application's current data.

| Tables | What they store |
|---|---|
| `publishers`, `series`, `series_titles` | Publishers, publication lines, and titles tagged by language such as `th`, `ja`, and `en`. |
| `books`, `sources`, `book_sources` | One book per series, edition, and volume, with many-to-many links to source evidence. |
| `shelves`, `shelf_items` | One shelf per Supabase Auth user, with one ownership entry per book. |
| `review_items`, `review_candidates`, `store_clicks` | Ingestion review and store click events. |

Book and source IDs carry over from the JSON contracts. The database accepts fractional volume numbers and an optional, unique ISBN-13 stored as digits. Month-only dates use the first of the month with `release_date_precision = 'month'`. The day is a storage convention.

All tables have row level security. The underlying schema stays outside the Data API. The [demo connection migration](../supabase/migrations/20261121060134_connect_demo_app.sql) exposes a small set of functions to authenticated fixture accounts. The database derives the shelf owner from the Auth token and applies shelf changes and the timestamp update in one transaction. The [local demo instructions](../web/README.md#local-supabase-demo) describe how to enable the Supabase backend.

## Future extensions

- **ISBN in the app.** Ingestion can populate the optional database field when an authorized source identifies the exact publication. A future catalog contract can expose that field to the app while keeping `book_id` as the stable identifier.
- **Licensing.** A separate workflow could track rights holders, local publishers, language, territory, and format. A license announcement can precede any volume details, so model it separately from the volume announcement workflow.
