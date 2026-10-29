# egypt-price-scraper

Search one product across about 20 Egyptian online shops and get the offers back as
normalized listings: title, price in EGP, rating, stock note, link.

```
$ npx tsx src/cli.ts "logitech g102"
        EGP  Shop              Title                                                 Link
        865  Noon              Logitech G102 Light Sync Gaming Mouse with Customi…   https://www.noon.com/egypt-en/…
        869  Amazon.eg         Logitech G102 Light Sync Gaming Mouse with Customi…   https://www.amazon.eg/dp/B0895DY6F5
        899  Compumarts        Logitech® G102 LIGHTSYNC Gaming Mouse - BLACK - EER   https://www.compumarts.com/products/…
        950  El Badr Group     Logitech G102 LIGHTSYNC RGB 6 Button Gaming Mouse     https://elbadrgroupeg.store/…
        999  Kimo Store        Logitech G102 Lightsync Wired RGB Gaming Mouse 800…   https://kimostore.net/products/…
      1,000  Elnekhely Techn…  [out of stock] Logitech G102 LIGHTSYNC Gaming Mou…   https://www.elnekhelytechnology.com/…
      1,049  2B                Logitech G102 Light sync Gaming Mouse EER910-00582…   https://2b.com.eg/en/…
      1,099  B.TECH            Logitech G102 Wired Gaming Mouse , Black              https://btech.com/en/p/…
      1,250  Dream 2000        Logitech Mouse Gaming Wired G102                      https://dream2000.com/en/products/…
      …

found: B.TECH, 2B, Amazon.eg, Noon, Jumia, Compumarts, Dream 2000, Raya Shop, Kimo Store, Elnekhely Technology, El Badr Group, Egypt Laptop
none: Carrefour, Sigma Computer, Dubai Phone, Raneen, Hyper One, Maximum Hardware, IKEA, Homzmart
```

Each shop is read with plain HTTP (its search page, search JSON or GraphQL endpoint).
Shops that can't be read that way are covered through [Pricena](https://eg.pricena.com),
a public price-comparison site, which also fills in when a shop's own search fails.
Listing titles are then matched against the query, so accessories ("case for AirPods Pro 2")
and other models ("Fit 4 Pro" when you asked for "Fit 4") are dropped.

Requires Node 20+. `curl` should be installed: Amazon.eg serves a bot check to Node's own
`fetch` but not to curl. Without curl everything falls back to `fetch`.

## Supported shops

"Datacenter" is whether the shop answered from a cloud VM (as opposed to a home
connection) when last checked in October 2026. Shops change; expect breakage.

| Shop | id | How it's read | Datacenter |
|---|---|---|---|
| B.TECH | `btech` | Search page, Next.js streamed payload (first 20) | yes |
| 2B | `2b` | Magento search page | flaky (Cloudflare) |
| Amazon.eg | `amazon` | Search page HTML (curl) | flaky (bot check, retried) |
| Noon | `noon` | Server-rendered search page | yes |
| Jumia | `jumia` | Search page HTML | no (Cloudflare 403 → `blocked`) |
| Compumarts | `compumarts` | Shopify `suggest.json` | yes |
| Dream 2000 | `dream2000` | Shopify `suggest.json` + `products/<handle>.js` for storage variants | yes |
| Raya Shop | `raya` | Magento GraphQL | yes |
| Raneen | `raneen` | Its search JSON | yes |
| Hyper One | `hyperone` | Magento GraphQL | yes |
| Kimo Store | `kimostore` | Shopify `suggest.json` | yes |
| Elnekhely Technology | `elnekhely` | OpenCart (Journal 3) search page | no (Cloudflare) |
| El Badr Group | `elbadr` | OpenCart (Journal 3) search page | no (Cloudflare) |
| Maximum Hardware | `maximumhardware` | OpenCart (Journal 3) search page | yes |
| Egypt Laptop | `egyptlaptop` | CS-Cart search page | no (Cloudflare) |
| IKEA Egypt | `ikea` | IKEA's search API | untested |
| Homzmart | `homzmart` | Search page `__NEXT_DATA__` | untested |
| Carrefour | `carrefour` | Pricena only (Pricena dropped it in Oct 2026, so usually nothing) | n/a |
| Sigma Computer | `sigma` | Pricena only (search API behind Cloudflare Turnstile) | n/a |
| Dubai Phone | `dubaiphone` | Pricena only (needs a real browser; not supported) | n/a |

Not supported: Sharaf DG Egypt (stale prices), El Araby (503), Cairo Sales and Gamers Colony
(Cloudflare), and anything that needs a headless browser.

## CLI

```
npm install
npx tsx src/cli.ts "iphone 16 pro 256gb"
npx tsx src/cli.ts --shops btech,noon,amazon "airpods pro 2"
npx tsx src/cli.ts --category laptops --json "lenovo loq"
npx tsx src/cli.ts --list-shops
```

Or `npm run build` and use `node dist/cli.js` (the package's `bin` is `egypt-price-scraper`).

Options: `--shops <ids>`, `--category <laptops|phones|appliances|electronics|furniture>`,
`--json`, `--raw` (keep listings whose titles don't match), `--ref-price <egp>`, `--no-pricena`,
`--timeout <s>`. Rows marked `*` come from Pricena and link to its product page.

## Library

```ts
import { searchAll, searchShop, SHOPS, titleMatches } from 'egypt-price-scraper'

const { listings, sources } = await searchAll('airpods pro 2', {
  shops: ['btech', 'amazon', 'noon'], // default: all
  timeoutMs: 20_000,                  // per shop, default 25 s
  concurrency: 4,                     // shops read at once, default 6
})
// listings: Listing[] cheapest first
//   { source, store, title, url, price, rating, ratingCount, sold, image, storeSearchUrl, via }
// sources: one row per shop
//   { source, store, status: 'found' | 'none' | 'failed' | 'blocked', via, count, error? }

const raw = await searchShop('noon', 'airpods pro 2') // one shop, unfiltered
```

Other options: `pricena: false`, `match: false` (no title filtering) or your own
`match(title)`, `refPrice` (drop listings below 0.3x or above 3x a price you were quoted),
and `io` to swap the network layer (proxy, cache, tests).

Matching helpers are exported on their own: `titleMatches(title, query)`,
`isAccessory(title, tokens)`, `filterListings(listings, query)`, `rankListings(listings)`
(most reviewed first, then cheapest), `sameModel(title, query)`.

`blocked` means the shop refuses your IP (Cloudflare 403 or challenge), not that it's down.
From a home connection most shops answer; from a cloud VM several don't (see the table).

## Limits

Matching is by title words, so a clone titled "AirPods Pro 2 Wireless Earphones" at 200 EGP
matches "airpods pro 2". When clones outnumber the real thing, the outlier filter (prices far
from the median) can drop the real one instead. Pass a rough price (`--ref-price 10000`,
`refPrice` in the library) to keep only listings between 0.3x and 3x of it.

B.TECH returns only its first 20 results, and Shopify shops their first 10.

## Be gentle

This is for personal price checks, not crawling. Each `searchAll` makes about 20-25
requests (one per shop, plus a few Pricena pages).

- Don't loop it. Several shops rate-limit: Amazon starts serving bot checks after about
  150 searches a day from one IP, Noon throws HTTP/2 errors after about 40 quick searches,
  Dream 2000 returns 429 on product pages after about 10.
- HTTP 4xx answers (403, 429) are never retried. Network errors and bot-check pages are
  retried a couple of times with a delay.
- Respect each shop's terms and robots.txt. Prices and stock are the shops' data, and the
  offers Pricena relays are Pricena's.

## Adding a shop

1. Create `src/shops/<id>.ts` with a pure parser (`parseXSearch(html): Listing[]`) and a
   `ShopDef`: `id`, `name`, `domain`, `categories`, `mode: 'direct'`, `searchUrl(q)`,
   `search(q, io)`, and `pricenaName` (a regex for how Pricena names the shop, if it lists it).
   Shopify, Magento GraphQL and OpenCart Journal 3 shops can reuse `shopify.ts`, `magento.ts`
   and `journal.ts` in a few lines (see `kimostore.ts`).
2. Throw `BlockedError` when the shop refuses you (wrap the fetch in `blockAware()`), and throw
   instead of returning `[]` when the page isn't a search page. Otherwise a block page shows up
   as "none".
3. Add it to `SHOPS` in `src/shops/index.ts`.
4. Save one search answer, trimmed to two or three products, in `test/fixtures/` and add a
   parser test in `test/parsers.test.ts`.

## Development

```
npm test          # offline: parsers on saved fixtures, matching, orchestration
npm run typecheck
npm run build
```

## License

MIT, Ahmed Osama Helmy.
