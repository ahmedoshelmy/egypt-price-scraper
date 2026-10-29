import type { Listing } from '../types.js'
import type { ShopDef } from '../types.js'

const base = 'https://homzmart.com/en'

/**
 * Homzmart (Next.js over Magento): the search page carries its results in
 * __NEXT_DATA__ (pageProps.initialData.products.items) with name, url_key,
 * final price, stock, image and rating (rating_summary, out of 5).
 */
export function parseHomzmartSearch(html: string): Listing[] {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) throw new Error('Homzmart showed no search page')
  const items = JSON.parse(m[1])?.props?.pageProps?.initialData?.products?.items
  if (!Array.isArray(items)) throw new Error('Homzmart answered no product list')
  return (items as any[]).filter(p => p?.name && p.url_key).map((p): Listing => {
    const price = Number(p.price_range?.minimum_price?.final_price?.value ?? p.special_price)
    const n = Number(p.review_count)
    const stars = Number(p.rating_summary)
    return {
      source: 'homzmart', store: 'Homzmart', title: String(p.name).replace(/\s+/g, ' ').trim(), url: `${base}/p/${p.url_key}`, storeSearchUrl: null,
      price: price > 0 ? price : null,
      rating: n > 0 && stars > 0 && stars <= 5 ? stars : null, ratingCount: n > 0 ? n : null,
      sold: p.stock_status && p.stock_status !== 'IN_STOCK' ? 'Out of stock' : null,
      image: typeof p.image?.url === 'string' ? p.image.url : null,
    }
  })
}

export const homzmart: ShopDef = {
  id: 'homzmart', name: 'Homzmart', domain: 'homzmart.com',
  categories: ['furniture'], mode: 'direct', pricenaName: /homzmart/i,
  searchUrl: q => `${base}/search?search=${encodeURIComponent(q)}`,
  // The search page answers a 500 now and then: one retry.
  search: async (q, io) => parseHomzmartSearch(await io.fetchText(`${base}/search?search=${encodeURIComponent(q)}`, 2)),
  note: 'Furniture. __NEXT_DATA__ on the search page, with ratings.',
}
