import { shopifySearch } from './shopify.js'
import type { ShopDef } from '../types.js'

const base = 'https://kimostore.net'
export const kimostore: ShopDef = {
  id: 'kimostore', name: 'Kimo Store', domain: 'kimostore.net',
  categories: ['laptops', 'electronics', 'appliances'], mode: 'direct', pricenaName: /kimo/i,
  searchUrl: q => `${base}/search?q=${encodeURIComponent(q)}&type=product`,
  search: shopifySearch({ id: 'kimostore', name: 'Kimo Store' }, { base }),
  datacenter: 'yes',
  note: 'Keyboards, mice, PC parts, grooming. Shopify suggest.json.',
}
