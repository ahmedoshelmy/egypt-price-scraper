import { journalSearch, journalSearchUrl } from './journal.js'
import type { ShopDef } from '../types.js'

const base = 'https://maximumhardware.store'
export const maximumhardware: ShopDef = {
  id: 'maximumhardware', name: 'Maximum Hardware', domain: 'maximumhardware.store',
  categories: ['laptops', 'electronics'], mode: 'direct', pricenaName: /maximum\s?hardware/i,
  searchUrl: q => journalSearchUrl(base, q),
  search: journalSearch({ id: 'maximumhardware', name: 'Maximum Hardware' }, base),
  datacenter: 'yes',
  note: 'PC parts and gaming gear. OpenCart (Journal 3).',
}
