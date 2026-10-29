import { magentoSearch } from './magento.js'
import type { ShopDef } from '../types.js'

const base = 'https://www.hyperone.com.eg/en'
export const hyperone: ShopDef = {
  id: 'hyperone', name: 'Hyper One', domain: 'hyperone.com.eg',
  categories: ['appliances', 'electronics'], mode: 'direct', pricenaName: /hyper\s?one/i,
  searchUrl: q => `${base}/search?q=${encodeURIComponent(q)}`,
  // Nuxt over Magento; the GraphQL host is mcprod (www's /graphql only takes POSTs).
  search: magentoSearch({ id: 'hyperone', name: 'Hyper One' }, { endpoint: 'https://mcprod.hyperone.com.eg/graphql', productBase: base }),
  datacenter: 'yes',
  note: 'Hypermarket: appliances, grooming. Magento GraphQL; its search is loose.',
}
