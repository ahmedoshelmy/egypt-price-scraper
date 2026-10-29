import { shopifySearch } from './shopify.js'
import type { ShopDef } from '../types.js'

const base = 'https://www.compumarts.com'
export const compumarts: ShopDef = {
  id: 'compumarts', name: 'Compumarts', domain: 'compumarts.com',
  categories: ['laptops', 'electronics'], mode: 'direct', pricenaName: /compumarts/i,
  searchUrl: q => `${base}/search?q=${encodeURIComponent(q)}&type=product`,
  search: shopifySearch({ id: 'compumarts', name: 'Compumarts' }, { base }),
  datacenter: 'yes',
  note: 'Laptops, PC parts, monitors. Shopify suggest.json.',
}
