import { journalSearch, journalSearchUrl } from './journal.js'
import type { ShopDef } from '../types.js'

const base = 'https://elbadrgroupeg.store'
export const elbadr: ShopDef = {
  id: 'elbadr', name: 'El Badr Group', domain: 'elbadrgroupeg.store',
  categories: ['laptops', 'electronics'], mode: 'direct', pricenaName: /badr/i,
  searchUrl: q => journalSearchUrl(base, q),
  search: journalSearch({ id: 'elbadr', name: 'El Badr Group' }, base),
  datacenter: 'no',
  note: 'PC parts and gaming gear. OpenCart (Journal 3). Cloudflare challenges datacenter IPs.',
}
