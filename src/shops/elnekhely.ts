import { journalSearch, journalSearchUrl } from './journal.js'
import type { ShopDef } from '../types.js'

const base = 'https://www.elnekhelytechnology.com'
export const elnekhely: ShopDef = {
  id: 'elnekhely', name: 'Elnekhely Technology', domain: 'elnekhelytechnology.com',
  categories: ['laptops', 'electronics'], mode: 'direct', pricenaName: /nekhely/i,
  searchUrl: q => journalSearchUrl(base, q),
  search: journalSearch({ id: 'elnekhely', name: 'Elnekhely Technology' }, base),
  datacenter: 'no',
  note: 'PC parts and gaming gear. OpenCart (Journal 3). Cloudflare challenges datacenter IPs.',
}
