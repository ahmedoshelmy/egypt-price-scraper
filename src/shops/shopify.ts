// Shared adapter for Shopify shops (Compumarts, Dream 2000…): the storefront's
// predictive search JSON, else the search page's product links read one by
// one from /products/<handle>.js. Prices in .js are in piasters.
//
// Dream 2000 lists "Apple iPhone 17 Pro Max" once, with storage and colour as
// Shopify variants: a search naming a size ("… 256GB") would never match that
// title, so such products are opened and listed once per variant.

import type { Listing } from '../types.js'
import type { ShopDef, ShopIo } from '../types.js'

export interface ShopifyOptions {
  base: string // https://www.compumarts.com
  /** Path prefix for the storefront language, e.g. "/en" (Dream 2000 refuses suggest.json without it). */
  locale?: string
  limit?: number
}



export function parseShopifySuggest(json: string, base: string, store: string, source: string): Listing[] {
  const products = JSON.parse(json)?.resources?.results?.products ?? []
  return (products as any[]).map(p => ({
    source, store,
    title: String(p.title ?? '').trim(),
    url: new URL(String(p.url ?? `/products/${p.handle}`).replace(/\?.*$/, ''), base).toString(),
    storeSearchUrl: null,
    price: Number.isFinite(Number(p.price)) && Number(p.price) > 0 ? Number(p.price) : null,
    rating: null, ratingCount: null,
    sold: p.available === false ? 'Out of stock' : null,
    image: typeof p.image === 'string' ? p.image : null,
  })).filter(l => l.title)
}

/** Sizes a query names ("256GB", "1 TB", "16GB RAM"). */
const SIZES = /\b\d+(?:\.\d+)?\s?(?:gb|tb)\b/gi
const sizesIn = (s: string) => (s.match(SIZES) ?? []).map(x => x.replace(/\s/g, '').toLowerCase())

/** Products whose title leaves out a size the query names and that come in several variants (prices differ). */
export function needsVariants(json: string, q: string): string[] {
  const want = sizesIn(q)
  if (!want.length) return []
  const products = JSON.parse(json)?.resources?.results?.products ?? []
  return (products as any[])
    .filter(p => p.handle && Number(p.price_max) > Number(p.price_min) && !want.every(w => sizesIn(String(p.title ?? '')).includes(w)))
    .map(p => String(p.handle))
}

/** /products/<handle>.js → one listing per variant: "<title> 256GB / Deep Blue", its own price, stock and link. */
export function parseShopifyVariants(json: string, url: string, store: string, source: string): Listing[] {
  const p = JSON.parse(json)
  if (!p?.title || !Array.isArray(p.variants)) return []
  const image = typeof p.featured_image === 'string' ? (p.featured_image.startsWith('//') ? `https:${p.featured_image}` : p.featured_image) : null
  return (p.variants as any[]).filter(v => v?.title && v.title !== 'Default Title').map(v => {
    const price = Number(v.price) / 100
    return {
      source, store, title: `${String(p.title).trim()} ${String(v.title).trim()}`, url: `${url}?variant=${v.id}`, storeSearchUrl: null,
      price: price > 0 ? price : null, rating: null, ratingCount: null,
      sold: v.available === false ? 'Out of stock' : null,
      image: typeof v.featured_image?.src === 'string' ? v.featured_image.src : image,
    }
  })
}

/** /products/<handle>.js → one listing (price in piasters). */
export function parseShopifyProduct(json: string, url: string, store: string, source: string): Listing | null {
  const p = JSON.parse(json)
  if (!p?.title) return null
  const price = Number(p.price) / 100
  return {
    source, store, title: String(p.title).trim(), url, storeSearchUrl: null,
    price: price > 0 ? price : null, rating: null, ratingCount: null,
    sold: p.available === false ? 'Out of stock' : null,
    image: typeof p.featured_image === 'string' ? (p.featured_image.startsWith('//') ? `https:${p.featured_image}` : p.featured_image) : null,
  }
}

export function shopifySearch(def: Pick<ShopDef, 'id' | 'name'>, o: ShopifyOptions) {
  const loc = o.locale ?? ''
  const limit = o.limit ?? 10
  return async (q: string, io: ShopIo): Promise<Listing[]> => {
    const suggest = `${o.base}${loc}/search/suggest.json?q=${encodeURIComponent(q)}&resources%5Btype%5D=product&resources%5Blimit%5D=${limit}`
    let json: string
    try {
      json = await io.fetchText(suggest, 1)
    } catch {
      // Fallback: the search page's product links, each read from its .js.
      const html = await io.fetchText(`${o.base}${loc}/search?q=${encodeURIComponent(q)}&type=product`, 1)
      const handles = [...new Set([...html.matchAll(/href="(?:\/[a-z]{2})?\/products\/([a-z0-9-]+)/gi)].map(m => m[1]))].slice(0, 6)
      const out = await Promise.all(handles.map(h => {
        const url = `${o.base}${loc}/products/${h}`
        return io.fetchText(`${url}.js`, 1).then(j => parseShopifyProduct(j, url, def.name, def.id)).catch(() => null)
      }))
      return out.filter((l): l is Listing => !!l)
    }
    const found = parseShopifySuggest(json, o.base, def.name, def.id)
    if (!io.sameModel) return found
    // The searched model, sold in several sizes under one title: list its variants.
    const handles = needsVariants(json, q).filter(h => found.some(l => l.url.endsWith(`/products/${h}`) && io.sameModel!(l.title, q))).slice(0, 3)
    if (!handles.length) return found
    let unread = 0
    const expanded = await Promise.all(handles.map(h => {
      const url = `${o.base}${loc}/products/${h}`
      return io.fetchText(`${url}.js`, 1).then(j => parseShopifyVariants(j, url, def.name, def.id)).catch(() => { unread++; return [] as Listing[] })
    }))
    // The product is there but its sizes couldn't be read (the shop rate-limits product pages):
    // "couldn't read", not "not listed".
    if (unread === handles.length) throw new Error(`${def.name} didn't answer for the product's sizes`)
    return [...found.filter(l => !handles.some(h => l.url.endsWith(`/products/${h}`))), ...expanded.flat()]
  }
}
