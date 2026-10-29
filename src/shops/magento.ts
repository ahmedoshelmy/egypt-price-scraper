// Shared adapter for Magento 2 shops whose storefront is a headless app
// (Raya Shop, Hyper One): the public GraphQL `products(search:)` query, sent as
// a GET so it needs no extra headers. Their search pages render client-side,
// so the HTML has no products to read.

import type { Listing } from '../types.js'
import type { ShopDef, ShopIo } from '../types.js'

export interface MagentoOptions {
  /** GraphQL endpoint, e.g. https://api-rayashop.global.ssl.fastly.net/graphql */
  endpoint: string
  /** Product pages live at `${productBase}/${url_key}`, e.g. https://www.rayashop.com/en */
  productBase: string
  limit?: number
}

const QUERY = (q: string, n: number) =>
  `{products(search:${JSON.stringify(q)},pageSize:${n}){items{name url_key stock_status small_image{url} price_range{minimum_price{final_price{value}}}}}}`

export const magentoSearchUrl = (o: MagentoOptions, q: string) => `${o.endpoint}?query=${encodeURIComponent(QUERY(q, o.limit ?? 12))}`

/** GraphQL `products.items` → listings (prices in EGP, sometimes with tax-rounding noise: 7999.995601). */
export function parseMagentoProducts(json: string, productBase: string, store: string, source: string): Listing[] {
  const d = JSON.parse(json)
  if (!d?.data?.products) throw new Error(`${store} answered no products (${String(d?.errors?.[0]?.message ?? 'bad answer').slice(0, 80)})`)
  return ((d.data.products.items ?? []) as any[]).filter(p => p?.name && p.url_key).map(p => {
    const price = Math.round(Number(p.price_range?.minimum_price?.final_price?.value) * 100) / 100
    const img = p.small_image?.url
    return {
      source, store, title: String(p.name).replace(/\s+/g, ' ').trim(), url: `${productBase}/${p.url_key}`, storeSearchUrl: null,
      price: price > 0 ? price : null, rating: null, ratingCount: null,
      sold: p.stock_status === 'OUT_OF_STOCK' ? 'Out of stock' : null,
      // Magento's placeholder image is not a photo of the product.
      image: typeof img === 'string' && !/placeholder/i.test(img) ? img : null,
    }
  })
}

export function magentoSearch(def: Pick<ShopDef, 'id' | 'name'>, o: MagentoOptions) {
  return async (q: string, io: ShopIo): Promise<Listing[]> =>
    parseMagentoProducts(await io.fetchText(magentoSearchUrl(o, q), 2), o.productBase, def.name, def.id)
}
