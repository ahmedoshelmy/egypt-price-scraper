import type { Listing } from '../types.js'
import type { ShopDef } from '../types.js'

const base = 'https://www.raneen.com/en'

/**
 * Raneen (Magento) fills its search page from its own Vertex AI search JSON:
 * products[] with title, url, imageUrl, price (EGP) and availability.
 */
export function parseRaneenSearch(json: string): Listing[] {
  const d = JSON.parse(json)
  if (!Array.isArray(d?.products)) throw new Error('Raneen answered no product list')
  return (d.products as any[]).filter(p => p?.title && p.url && !p.isSponsored).map(p => {
    const price = Number(p.price)
    return {
      source: 'raneen', store: 'Raneen', title: String(p.title).replace(/\s+/g, ' ').trim(), url: String(p.url), storeSearchUrl: null,
      price: price > 0 ? price : null,
      rating: null, ratingCount: null,
      sold: p.availability && p.availability !== 'IN_STOCK' ? 'Out of stock' : null,
      image: typeof p.imageUrl === 'string' ? p.imageUrl : null,
    }
  })
}

export const raneen: ShopDef = {
  id: 'raneen', name: 'Raneen', domain: 'raneen.com',
  categories: ['appliances', 'electronics', 'phones', 'furniture'], mode: 'direct', pricenaName: /raneen/i,
  searchUrl: q => `${base}/catalogsearch/result/?q=${encodeURIComponent(q)}`,
  search: async (q, io) => parseRaneenSearch(await io.fetchText(`${base}/vertex/search/query/?q=${encodeURIComponent(q)}`, 2)),
  datacenter: 'yes',
  note: 'Appliances, grooming, some electronics. Its Vertex search JSON.',
}
