import { shopifySearch } from './shopify.js'
import type { ShopDef } from '../types.js'

const base = 'https://dream2000.com'
export const dream2000: ShopDef = {
  id: 'dream2000', name: 'Dream 2000', domain: 'dream2000.com',
  categories: ['phones', 'laptops', 'appliances', 'electronics'], mode: 'direct', pricenaName: /dream\s*2000/i,
  searchUrl: q => `${base}/en/search?q=${encodeURIComponent(q)}&type=product`,
  // Its suggest.json needs the /en prefix ("Unsupported buyer locale" without it).
  search: shopifySearch({ id: 'dream2000', name: 'Dream 2000' }, { base, locale: '/en' }),
  datacenter: 'yes',
  note: 'Phones, laptops, TVs, appliances. Shopify; storage sizes are expanded from variants. Mostly Arabic titles; rate-limits product pages.',
}
