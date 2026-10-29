import { magentoSearch } from './magento.js'
import type { ShopDef } from '../types.js'

const base = 'https://www.rayashop.com/en'
export const raya: ShopDef = {
  id: 'raya', name: 'Raya Shop', domain: 'rayashop.com',
  categories: ['phones', 'laptops', 'appliances', 'electronics'], mode: 'direct', pricenaName: /raya/i,
  searchUrl: q => `${base}/catalogsearch/result?q=${encodeURIComponent(q)}`,
  // The site is a Nuxt app over Magento; its GraphQL answers plain GETs.
  search: magentoSearch({ id: 'raya', name: 'Raya Shop' }, { endpoint: 'https://api-rayashop.global.ssl.fastly.net/graphql', productBase: base }),
  datacenter: 'yes',
  note: 'Phones, laptops, appliances. Magento GraphQL (GET).',
}
