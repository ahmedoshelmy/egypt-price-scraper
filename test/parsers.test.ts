import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.js'
import { parseAmazonSearch } from '../src/shops/amazon.js'
import { parseBtechSearch, parseBtechListing } from '../src/shops/btech.js'
import { parse2bSearch } from '../src/shops/twob.js'
import { parseNoonSearch } from '../src/shops/noon.js'
import { parseJumiaSearch } from '../src/shops/jumia.js'
import { parseShopifySuggest, parseShopifyVariants, needsVariants } from '../src/shops/shopify.js'
import { parseMagentoProducts } from '../src/shops/magento.js'
import { parseRaneenSearch } from '../src/shops/raneen.js'
import { parseIkeaSearch } from '../src/shops/ikea.js'
import { parseHomzmartSearch } from '../src/shops/homzmart.js'
import { parseJournalSearch } from '../src/shops/journal.js'
import { parseEgyptLaptopSearch } from '../src/shops/egyptlaptop.js'
import { parsePricenaSearch, parsePricenaOffers, storeSlug } from '../src/pricena.js'
import { SHOPS } from '../src/shops/index.js'
import { parseNumber, decode, stripTags, isBotChallenge, isCloudflareChallenge } from '../src/net.js'

test('Amazon: title from both <h2>s, price, stars, rating count, sales note, own ASIN', () => {
  const ls = parseAmazonSearch(fixture('amazon-search.html'))
  assert.equal(ls.length, 2)
  assert.match(ls[0].title, /^Sonix Tech AirPods Pro 2 Wireless/)
  assert.equal(ls[0].price, 194)
  assert.equal(ls[0].rating, 2.4)
  assert.equal(ls[0].ratingCount, 47)
  assert.equal(ls[0].sold, '400+ bought in past month')
  assert.equal(ls[0].url, 'https://www.amazon.eg/dp/B0G4R2LFLD')
  assert.equal(ls[1].url, 'https://www.amazon.eg/dp/B0C7LP5D2M')
  assert.ok(ls.every(l => l.source === 'amazon' && l.image?.startsWith('https://')))
})

test('B.TECH: products from the streamed Next.js payload, split across chunks', () => {
  const page = parseBtechListing(fixture('btech-search.html'))
  assert.equal(page.products.length, 3)
  assert.ok(page.total >= 3)
  const ls = parseBtechSearch(fixture('btech-search.html'))
  const airpods = ls.find(l => /AirPods Pro 3/.test(l.title))!
  assert.equal(airpods.price, 14999)
  assert.match(airpods.url, /^https:\/\/btech\.com\/en\/p\/[\w-]+\?offering_id=[0-9a-f-]{36}$/)
  assert.match(airpods.image!, /^https:\/\/media\.btech\.com\//)
})

test('2B: final price, stock and link', () => {
  const ls = parse2bSearch(fixture('2b-search.html'))
  assert.equal(ls.length, 3)
  assert.equal(ls[0].title, 'Xiaomi Redmi Note 14 Pro Plus - 12GB RAM - 512GB - Black')
  assert.equal(ls[0].price, 25999)
  assert.equal(ls[0].sold, 'Out of stock')
  assert.equal(ls[0].rating, null) // nobody rated: 2B shows "0.0 (0)"
  assert.match(ls[0].url, /^https:\/\/2b\.com\.eg\/en\/.+\.html$/)
})

test('Noon: price, stars, "1.7K" rating counts, clean product URL', () => {
  const ls = parseNoonSearch(fixture('noon-search.html'))
  assert.equal(ls.length, 3)
  assert.equal(ls[2].title, 'New Air Pods Pro 2nd generation USA - White')
  assert.equal(ls[2].price, 279)
  assert.equal(ls[2].rating, 3.3)
  assert.equal(ls[2].ratingCount, 1700)
  assert.equal(ls[1].ratingCount, 25000)
  assert.ok(ls.every(l => l.url.startsWith('https://www.noon.com/egypt-en/') && !l.url.includes('?')))
})

test('Jumia: cards with EGP prices', () => {
  const ls = parseJumiaSearch(fixture('jumia-search.html'))
  assert.equal(ls.length, 3)
  assert.equal(ls[0].title, 'XIAOMI Redmi Note 14 Pro+ Dual SIM 4G 256GB/12GB - Lavender Purple')
  assert.equal(ls[0].price, 23999)
  assert.equal(ls[1].price, 26333)
  assert.ok(ls.every(l => l.url.startsWith('https://www.jumia.com.eg/') && l.url.endsWith('.html')))
})

test('Shopify suggest.json: price, stock, absolute URL', () => {
  const ls = parseShopifySuggest(fixture('compumarts-suggest.json'), 'https://www.compumarts.com', 'Compumarts', 'compumarts')
  assert.equal(ls.length, 3)
  assert.equal(ls[0].price, 899)
  assert.equal(ls[0].url, 'https://www.compumarts.com/products/logitech-g102-light-gaming-customizable-lighting')
  assert.equal(ls[1].sold, 'Out of stock')
})

test('Shopify variants: a size in the query opens products whose title leaves it out', () => {
  const suggest = fixture('dream2000-suggest.json')
  assert.deepEqual(needsVariants(suggest, 'iphone 16 128gb'), ['iphone-16'])
  assert.deepEqual(needsVariants(suggest, 'iphone 16'), [])
  const ls = parseShopifyVariants(fixture('dream2000-product.json'), 'https://dream2000.com/en/products/iphone-16', 'Dream 2000', 'dream2000')
  assert.equal(ls.length, 4)
  assert.equal(ls[0].title, 'Apple iPhone 16 8GB / 128GB / Black')
  assert.equal(ls[0].price, 74990) // piasters → EGP
  assert.match(ls[0].url, /\?variant=\d+$/)
})

test('Magento GraphQL (Raya): rounded price, placeholder image dropped', () => {
  const ls = parseMagentoProducts(fixture('raya-graphql.json'), 'https://www.rayashop.com/en', 'Raya Shop', 'raya')
  assert.equal(ls.length, 3)
  assert.equal(ls[0].price, 23099)
  assert.equal(ls[1].image, null)
  assert.equal(ls[2].url, 'https://www.rayashop.com/en/samsung-galaxy-a56-dual-sim-256gb-8gb-ram-5g-awesome-olive-12')
  assert.throws(() => parseMagentoProducts('{"errors":[{"message":"nope"}]}', 'x', 'Raya Shop', 'raya'), /nope/)
})

test('Raneen: search JSON without sponsored products', () => {
  const ls = parseRaneenSearch(fixture('raneen-search.json'))
  assert.equal(ls.length, 3)
  assert.equal(ls[1].price, 6411)
  assert.match(ls[1].title, /^Braun Series 5 HC5350/)
})

test('IKEA: title from name, type, design and size; ratings', () => {
  const ls = parseIkeaSearch(fixture('ikea-search.json'))
  assert.deepEqual(ls.map(l => [l.title, l.price, l.rating, l.ratingCount]), [
    ['MICKE Desk, white, 73x50 cm', 5495, 4.4, 49],
    ['MICKE Desk, white, 105x50 cm', 9995, 4.5, 61],
    ['MICKE Desk, white, 142x50 cm', 9995, 4.7, 22],
  ])
})

test('Homzmart: __NEXT_DATA__ items, rating only with reviews', () => {
  const ls = parseHomzmartSearch(fixture('homzmart-search.html'))
  assert.equal(ls.length, 3)
  assert.equal(ls[0].price, 4792)
  assert.deepEqual([ls[0].rating, ls[0].ratingCount], [5, 1])
  assert.deepEqual([ls[1].rating, ls[1].ratingCount], [null, null])
  assert.throws(() => parseHomzmartSearch('<html></html>'), /no search page/)
})

test('OpenCart Journal (Elnekhely): grid cards, stock, URL without search params', () => {
  const ls = parseJournalSearch(fixture('elnekhely-search.html'), 'Elnekhely Technology', 'elnekhely')
  assert.equal(ls.length, 2)
  assert.equal(ls[0].title, 'Logitech G102 LIGHTSYNC Gaming Mouse Black')
  assert.equal(ls[0].price, 1000)
  assert.equal(ls[0].sold, 'Out of stock')
  assert.ok(!ls[0].url.includes('search='))
  // An empty search shows "featured" products in the same grid: none of them count.
  assert.deepEqual(parseJournalSearch('<p>There is no product that matches the search criteria.</p><div class="main-products"><div class="product-layout">x</div></div>', 'X', 'x'), [])
})

test('Egypt Laptop (CS-Cart): price with zero-width joiners', () => {
  const ls = parseEgyptLaptopSearch(fixture('egyptlaptop-search.html'))
  assert.deepEqual(ls.map(l => [l.title, l.price]), [
    ['Logitech G102 Light Sync Gaming Mouse 910-005823 - Black', 999],
    ['Logitech G102 Light Sync Gaming Mouse 910-005824 - White', 999],
  ])
})

test('Pricena search: schema.org ItemList', () => {
  const ps = parsePricenaSearch(fixture('pricena-search.html'))
  assert.equal(ps.length, 4)
  assert.deepEqual([ps[0].name, ps[0].price], ['Apple AirPods Pro 2', 10999])
  assert.ok(ps.every(p => p.url.startsWith('https://eg.pricena.com/')))
})

test('Pricena offers: only the page\'s own store grid, not other products\' buttons', () => {
  const url = 'https://eg.pricena.com/en/product/apple-airpods-pro-2-price-in-egypt'
  const ls = parsePricenaOffers(fixture('pricena-product.html'), url, 'airpods pro 2', SHOPS)
  assert.equal(ls.length, 1)
  assert.equal(ls[0].source, 'amazon')
  assert.equal(ls[0].store, 'Amazon.eg')
  assert.equal(ls[0].price, 10999)
  assert.equal(ls[0].via, 'pricena')
  assert.match(ls[0].storeSearchUrl!, /amazon\.eg\/s\?k=airpods%20pro%202/)
})

test('Pricena store names map to registry ids', () => {
  assert.equal(storeSlug('Amazon EG', SHOPS).slug, 'amazon')
  assert.equal(storeSlug('B.Tech', SHOPS).slug, 'btech')
  assert.equal(storeSlug('Dubai Phone', SHOPS).slug, 'dubaiphone')
  assert.equal(storeSlug('Some New Shop!', SHOPS).slug, 'some-new-shop')
})

test('text helpers', () => {
  assert.equal(parseNumber('EGP 1,234.50'), 1234.5)
  assert.equal(parseNumber('6.5K'), 6500)
  assert.equal(parseNumber(''), null)
  assert.equal(decode('A &amp; B &#39;x&#39; &#x2013;'), "A & B 'x' –")
  assert.equal(stripTags('<b>Hi</b>  <i>there</i>'), 'Hi there')
  assert.ok(isBotChallenge('<meta content="5; URL=/s?k=x&bm-verify=abc">'))
  assert.ok(isCloudflareChallenge('<title>Just a moment...</title>'))
})
