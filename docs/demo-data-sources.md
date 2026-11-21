# ShelfPilot AI demo data sources

The [source index](../fixtures/demo/source-index.json) maps seven Thai publishers and imprints to local HTML files. Each publisher has 20 publication lines, including separate manga and light novel adaptations where applicable. A handful of extra rows cover multiple volumes, duplicate listings, and a special edition. Paths in the index are relative to the index itself. Each `source_id` matches a section ID in its HTML file.

The files contain curated Thai market titles, edition labels, and volume facts from public pages. They use demo HTML containing factual metadata. Japanese and English lookup titles appear in language tagged markup when available. These are curated search metadata and may differ from the titles printed on the Thai source page. Treat missing aliases, volume numbers, dates, and ISBNs as unknown. The fixtures are historical samples and public visibility alone does not establish authorization for automated collection or catalog import.

## Replay the sources

1. Select a `volume_announcement` from the index, such as `demo-luckpim-oct`. Read the corresponding section locally, extract its visible release text, and preserve the original URL and source ID. Keep the `.lookup-aliases` fields available for series matching, with their separate role as curated metadata.
2. In the planned ingestion hub, submit the text from that section to the server side LLM extractor with Structured Outputs. Expect an array of volume candidates because one announcement can cover multiple books. Extract publisher, title, volume, edition, and stated release details. Keep any month level window at month precision. Capture ISBN only when the exact publication has a sourced value.
3. Match candidates against the local catalog and resolve editions in code using the existing review rules. Record each candidate's provenance. A `publisher_listing` or `retailer_reference` can seed a series, identify a volume, or corroborate an ISBN. Creating a release announcement requires a release source. Leave series only entries without book records until volume evidence is available.
4. To add live collection later, use fetchers for authorized sites, retain the original URL and capture timestamp, and convert each page into the same per source text input. Some sites use dynamic listings or publish schedules as images, so they may need their own extraction method.

## Websites for later collection

| Publisher | Website to evaluate | Evidence used in the demo |
|---|---|---|
| Phoenix Next | [Phoenix Next](https://www.phoenixnext.com/) | [September volume notice](https://www.phoenixnext.com/guild/new-release-sep-26), [regular volume listing](https://www.phoenixnext.com/ln0837-01.html), [special set listing](https://www.phoenixnext.com/ln0837-02p.html) |
| Bongkoch Comics | [Bongkoch shop](https://www.bongkoch.com/shop/) | [August volume schedule](https://www.bongkoch.com/shop/index.php?route=simple_blog/article/view&simple_blog_article_id=826) |
| Luckpim | [Luckpim shop](https://www.luckpimshop.com/) | October volume schedule linked in the index, and [volume 1 with ISBN](https://www.luckpim.com/product/detail/1359) |
| Animag | [Animag shop](https://www.animagshop.com/) | [Publisher catalog](https://www.animagshop.com/category) with manga and light novel listings |
| DEXpress | [DEXpress shop](https://www.dexpress-shop.com/) | [Publisher catalog](https://www.dexpress-shop.com/category) and [new listings](https://www.dexpress-shop.com/showroom/new) |
| Siam Inter Comics | [Publisher site](https://www.siaminterbook.com/) and [Siam Inter Shop](https://www.yaakz.com/) | Publisher schedules and shop listings, supplemented by retailer references identified in the index |
| Vibulkij | [Vibulkij shop](https://www.vibulkijshop.com/) | [Manga listings](https://www.vibulkijshop.com/product/tag/manga) and series or volume pages linked in the index |

For title enrichment, consult original Japanese and English publisher pages when available. For example, the local Kaiju No. 8: Relax entry can be checked against [Shueisha's Japanese title page](https://books.shueisha.co.jp/items/contents.html?isbn=978-4-08-884312-4) and [VIZ's English title page](https://www.viz.com/shonenjump/chapters/kaiju-no-8-relax).
