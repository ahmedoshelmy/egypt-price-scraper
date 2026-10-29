import { parseNumber, stripTags } from '../net.js'
import type { Listing, ShopDef } from '../types.js'

export const amazonSearchUrl = (q: string) => `https://www.amazon.eg/s?k=${encodeURIComponent(q)}&language=en_AE`

/** Headings between results ("More results"), not part of a product's name. */
const AMAZON_SECTION = /^(more results|results|related searches|sponsored|need help\?|editorial recommendations)$/i

/** Amazon.eg search page → listings (price, stars, rating count, "bought in past month"). */
export function parseAmazonSearch(html: string): Listing[] {
  const out: Listing[] = []
  // Each result opens with <div … data-asin="…" … data-component-type="s-search-result">:
  // split at the tag's start, or each block would carry the next result's ASIN.
  const starts = [...html.matchAll(/<div\b[^>]*data-component-type="s-search-result"/g)].map(m => m.index!)
  for (const [i, at] of starts.entries()) {
    const block = html.slice(at, starts[i + 1] ?? html.length)
    const asin = block.match(/^<div\b[^>]*data-asin="([A-Z0-9]{10})"/)?.[1] ?? block.match(/\/dp\/([A-Z0-9]{10})/)?.[1]
    if (!asin) continue
    // The brand and the product name are separate <h2>s.
    const title = [...block.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => stripTags(m[1])).filter(t => !AMAZON_SECTION.test(t)).join(' ').trim()
    if (!title) continue
    // No buy-box offer: "No featured offers available · EGP 144,990.00 (1 new offer)".
    const offer = block.match(/No featured offers available[\s\S]{0,300}?EGP\s*(?:&nbsp;|\s)*([\d,]+(?:\.\d+)?)/)?.[1]
    out.push({
      source: 'amazon', store: 'Amazon.eg', title,
      url: `https://www.amazon.eg/dp/${asin}`,
      storeSearchUrl: null,
      price: parseNumber(block.match(/a-price-whole">([\d,]+)/)?.[1] ?? offer),
      rating: parseNumber(block.match(/([\d.]+) out of 5 stars/)?.[1]),
      ratingCount: parseNumber(block.match(/aria-label="([\d,.K]+) ratings?"/)?.[1]),
      sold: block.match(/([\dK+,]+\+? bought in past month)/)?.[1] ?? null,
      image: block.match(/<img[^>]+class="s-image"[^>]+src="([^"]+)"/)?.[1] ?? null,
    })
  }
  return out
}

// Amazon serves an Akamai JS challenge to Node's fetch but not to curl; with
// curl about 1 in 3 requests from a datacenter is still challenged (retried).
export const amazon: ShopDef = {
  id: 'amazon', name: 'Amazon.eg', domain: 'amazon.eg',
  categories: ['laptops', 'phones', 'appliances', 'electronics', 'furniture'], mode: 'direct', pricenaName: /amazon/i,
  searchUrl: amazonSearchUrl,
  search: async (q, io) => parseAmazonSearch(await io.fetchText(amazonSearchUrl(q), 3)),
  datacenter: 'flaky',
  note: 'Search page HTML, with ratings. Needs curl (Node fetch gets a bot check).',
}
