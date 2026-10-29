import { blockAware, decode, parseNumber, stripTags } from '../net.js'
import type { Listing, ShopDef } from '../types.js'

// 2b.com.eg is a Magento shop. Its search is literal about spacing
// ("Huawei GT6" hits, "Huawei GT 6" doesn't).

export const twoBSearchUrl = (q: string) => `https://2b.com.eg/en/catalogsearch/result/?q=${encodeURIComponent(q)}`

export function parse2bSearch(html: string): Listing[] {
  const out: Listing[] = []
  for (const block of html.split(/<li class="item product product-item/).slice(1)) {
    const link = block.match(/<a class="product-item-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!link) continue
    const title = stripTags(link[2])
    if (!title) continue
    // The final price, after any "was" price.
    const price = parseNumber(block.match(/data-price-amount="([\d.]+)"[^>]*data-price-type="finalPrice"/)?.[1])
    const count = parseNumber(block.match(/class="reviews-count">\s*\(?([\d,]+)/)?.[1]) ?? 0
    const inStock = /tocart-form/.test(block) && !/class="stock unavailable"/.test(block)
    out.push({
      source: '2b', store: '2B', title, url: decode(link[1]),
      storeSearchUrl: null,
      price,
      // 2B shows "0.0 (0)" for products nobody has rated.
      rating: count ? parseNumber(block.match(/class="rating-value">([\d.]+)/)?.[1]) : null,
      ratingCount: count || null,
      sold: inStock ? (block.match(/Only (\d+) left in stock/)?.[0] ?? null) : 'Out of stock',
      image: block.match(/<img class="product-image-photo[^"]*"[^>]*src="([^"]+)"/)?.[1] ?? null,
    })
  }
  return out
}

export const twoB: ShopDef = {
  id: '2b', name: '2B', domain: '2b.com.eg',
  categories: ['laptops', 'phones', 'appliances', 'electronics'], mode: 'direct', pricenaName: /^2b$/i,
  searchUrl: twoBSearchUrl,
  search: async (q, io) => parse2bSearch(await blockAware('2B', io.fetchText(twoBSearchUrl(q), 1))),
  datacenter: 'flaky',
  note: 'Magento search page. Cloudflare challenges datacenter IPs at times.',
}
