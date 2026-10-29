import { blockAware } from '../net.js'
import type { Listing, ShopDef } from '../types.js'

const base = 'https://www.jumia.com.eg'
const ent = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

/** Jumia's catalog search: one <article class="prd"> per product with name, price, stars and review count. */
export function parseJumiaSearch(html: string): Listing[] {
  const out: Listing[] = []
  for (const card of html.split('<article class="prd').slice(1)) {
    const href = card.match(/<a href="(\/[^"]+\.html)"[^>]*class="core"/)?.[1]
    const title = card.match(/<h3 class="name">([^<]+)<\/h3>/)?.[1]
    if (!href || !title) continue
    const price = Number((card.match(/<div class="prc[^"]*">\s*EGP\s*([\d,.]+)/)?.[1] ?? '').replace(/,/g, ''))
    const rating = Number(card.match(/class="stars _s">([\d.]+) out of 5/)?.[1])
    const n = Number(card.match(/class="rev">\((\d+)\)/)?.[1])
    out.push({
      source: 'jumia', store: 'Jumia', title: ent(title).trim(), url: `${base}${href}`, storeSearchUrl: null,
      price: price > 0 ? price : null,
      rating: rating > 0 && n ? rating : null, ratingCount: n || null,
      sold: /class="[^"]*\boos\b|Out of stock/i.test(card) ? 'Out of stock' : null,
      image: card.match(/<img[^>]*data-src="(https:\/\/[^"]+)"/)?.[1] ?? null,
    })
    if (out.length >= 30) break
  }
  return out
}

export const jumia: ShopDef = {
  id: 'jumia', name: 'Jumia', domain: 'jumia.com.eg',
  categories: ['laptops', 'phones', 'appliances', 'electronics', 'furniture'], mode: 'direct', pricenaName: /jumia/i,
  searchUrl: q => `${base}/catalog/?q=${encodeURIComponent(q)}`,
  // Cloudflare refuses datacenter IPs with 403: reported as "blocked".
  search: async (q, io) => parseJumiaSearch(await blockAware('Jumia', io.fetchText(`${base}/catalog/?q=${encodeURIComponent(q)}`, 1))),
  datacenter: 'no',
  note: 'Search page HTML, with ratings. Needs full browser headers.',
}
