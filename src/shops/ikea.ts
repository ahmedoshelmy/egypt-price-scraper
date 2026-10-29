import type { Listing } from '../types.js'
import type { ShopDef } from '../types.js'

const base = 'https://www.ikea.com/eg/en'

/**
 * IKEA Egypt's search API (the one its own search page calls): products with
 * name, type, design text, size, EGP price, rating and delivery availability.
 * Titles are put together as "MICKE Desk, white/anthracite, 105x50 cm".
 */
export function parseIkeaSearch(json: string): Listing[] {
  const d = JSON.parse(json)
  const items = d?.searchResultPage?.products?.main?.items
  if (!Array.isArray(items)) throw new Error('IKEA answered no product list')
  return (items as any[]).map(i => i?.product).filter(p => p?.name && typeof p.pipUrl === 'string').map((p): Listing => {
    const title = [`${p.name} ${p.typeName ?? ''}`.trim(), p.validDesignText, p.itemMeasureReferenceText].filter(Boolean).join(', ')
    const price = Number(p.salesPrice?.numeral)
    const rating = Number(p.ratingValue)
    const n = Number(p.ratingCount)
    const avail = Array.isArray(p.availability) ? p.availability.map((a: any) => String(a?.status ?? '')) : []
    return {
      source: 'ikea', store: 'IKEA', title, url: p.pipUrl, storeSearchUrl: null,
      price: price > 0 ? price : null,
      rating: rating > 0 && n > 0 ? rating : null, ratingCount: n > 0 ? n : null,
      sold: p.onlineSellable === false ? 'In store only' : avail.length && avail.every((s: string) => /OUT_OF_STOCK/.test(s)) ? 'Out of stock' : null,
      image: typeof p.mainImageUrl === 'string' ? p.mainImageUrl : null,
    }
  })
}

export const ikea: ShopDef = {
  id: 'ikea', name: 'IKEA', domain: 'ikea.com',
  categories: ['furniture'], mode: 'direct', pricenaName: /ikea/i,
  searchUrl: q => `${base}/search/?q=${encodeURIComponent(q)}`,
  search: async (q, io) => parseIkeaSearch(await io.fetchText(`https://sik.search.blue.cdtapps.com/eg/en/search-result-page?q=${encodeURIComponent(q)}&size=40&types=PRODUCT`, 2)),
  note: "Furniture. IKEA Egypt's own search API, with ratings.",
}
