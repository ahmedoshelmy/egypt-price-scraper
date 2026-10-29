import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.js'
import { searchAll, searchShop } from '../src/search.js'
import { HttpError } from '../src/net.js'
import type { ShopIo } from '../src/types.js'

type Route = [RegExp, string | Error | (() => Promise<string>)]
/** A fake network: the first route whose pattern matches the URL answers. */
const fakeIo = (routes: Route[], seen: string[] = []): ShopIo => ({
  async fetchText(url) {
    seen.push(url)
    for (const [re, a] of routes) {
      if (!re.test(url)) continue
      if (a instanceof Error) throw a
      return typeof a === 'function' ? a() : fixture(a)
    }
    throw new Error(`no route for ${url}`)
  },
})

const PRICENA: Route[] = [
  [/eg\.pricena\.com\/en\/search/, 'pricena-search.html'],
  [/eg\.pricena\.com\/en\/product\/apple-airpods-pro-2-price-in-egypt/, 'pricena-product.html'],
  [/eg\.pricena\.com\/en\/product\//, '<html></html>' as never],
]

test('searchAll: found / none / blocked / failed per shop, cheapest first', async () => {
  const io = fakeIo([
    [/amazon\.eg/, 'amazon-search.html'],
    [/noon\.com/, 'noon-search.html'],
    [/jumia\.com\.eg/, new HttpError('www.jumia.com.eg', 403)],
    [/btech\.com/, Object.assign(new Error('getaddrinfo ENOTFOUND btech.com'), { code: 'ENOTFOUND' })],
    ...PRICENA,
  ])
  const res = await searchAll('airpods pro 2', { shops: ['amazon', 'noon', 'jumia', 'btech', 'dubaiphone'], io })
  const st = Object.fromEntries(res.sources.map(s => [s.source, s.status]))
  assert.deepEqual(st, { btech: 'failed', amazon: 'found', noon: 'none', jumia: 'blocked', dubaiphone: 'none' })
  // Amazon was read directly, so Pricena's copy of its offer is not added.
  assert.ok(res.listings.every(l => l.via === 'direct'))
  assert.ok(res.listings.length >= 1)
  assert.ok(res.listings.every(l => /airpods pro 2/i.test(l.title)))
  assert.match(res.sources.find(s => s.source === 'jumia')!.error!, /refuses this IP/)
  const prices = res.listings.map(l => l.price ?? Infinity)
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b))
})

test('searchAll: Pricena fills in for a shop that could not be read', async () => {
  const io = fakeIo([[/amazon\.eg/, new Error('socket hang up')], ...PRICENA])
  const res = await searchAll('airpods pro 2', { shops: ['amazon'], io })
  assert.deepEqual(res.sources, [{ source: 'amazon', store: 'Amazon.eg', status: 'found', via: 'pricena', count: 1 }])
  assert.equal(res.listings[0].price, 10999)
  assert.equal(res.listings[0].via, 'pricena')
})

test('searchAll: pricena:false skips Pricena and Pricena-only shops', async () => {
  const seen: string[] = []
  const io = fakeIo([[/amazon\.eg/, 'amazon-search.html']], seen)
  const res = await searchAll('airpods pro 2', { shops: ['amazon', 'sigma'], io, pricena: false })
  assert.deepEqual(res.sources.map(s => s.source), ['amazon'])
  assert.ok(!seen.some(u => u.includes('pricena')))
})

test('searchAll: match:false keeps every listing; unknown shop ids throw', async () => {
  const io = fakeIo([[/noon\.com/, 'noon-search.html']])
  const res = await searchAll('airpods pro 2', { shops: ['noon'], io, pricena: false, match: false })
  assert.equal(res.listings.length, 3)
  await assert.rejects(searchAll('x', { shops: ['nope'], io }), /Unknown shop "nope"/)
})

test('searchAll: a shop that hangs is cut off by timeoutMs', async () => {
  const io = fakeIo([[/cdtapps/, () => new Promise<string>(() => {})]])
  const t0 = Date.now()
  const res = await searchAll('micke desk', { shops: ['ikea'], io, pricena: false, timeoutMs: 50 })
  assert.ok(Date.now() - t0 < 2000)
  assert.equal(res.sources[0].status, 'failed')
  assert.match(res.sources[0].error!, /timed out/)
})

test('searchAll: concurrency limits shops in flight', async () => {
  let inFlight = 0, peak = 0
  const slow = async () => { inFlight++; peak = Math.max(peak, inFlight); await new Promise(r => setTimeout(r, 10)); inFlight--; return '{"products":[]}' }
  const io = fakeIo([[/./, slow]])
  await searchAll('x', { shops: ['raneen', 'compumarts', 'kimostore', 'raya', 'hyperone'], io, pricena: false, concurrency: 2 })
  assert.ok(peak <= 2, `peak ${peak}`)
})

test('searchShop: raw results with the shop search link; Pricena-only shops throw', async () => {
  const io = fakeIo([[/sik\.search\.blue\.cdtapps\.com/, 'ikea-search.json']])
  const ls = await searchShop('ikea', 'micke desk', { io })
  assert.equal(ls.length, 3)
  assert.equal(ls[0].storeSearchUrl, 'https://www.ikea.com/eg/en/search/?q=micke%20desk')
  await assert.rejects(searchShop('sigma', 'x', { io }), /Pricena only/)
  await assert.rejects(searchShop('nope', 'x', { io }), /Unknown shop/)
})

test('Shopify shops expand storage variants when the query names a size', async () => {
  const io = fakeIo([
    [/dream2000\.com\/en\/search\/suggest\.json/, 'dream2000-suggest.json'],
    [/dream2000\.com\/en\/products\/iphone-16\.js/, 'dream2000-product.json'],
  ])
  const ls = await searchShop('dream2000', 'iphone 16 128gb', { io })
  assert.ok(ls.some(l => l.title === 'Apple iPhone 16 8GB / 128GB / Black' && l.price === 74990))
  assert.ok(!ls.some(l => l.title === 'Apple iPhone 16'))
})

test('searchAll: Pricena fills in when the shop answered but nothing matched', async () => {
  // Amazon's page has a 194 EGP "AirPods Pro 2" clone; with a quoted price of 10,000 it doesn't count,
  // so Pricena's copy of Amazon's genuine offer is used.
  const io = fakeIo([[/amazon\.eg/, 'amazon-search.html'], ...PRICENA])
  const plain = await searchAll('airpods pro 2', { shops: ['amazon'], io })
  assert.deepEqual(plain.listings.map(l => [l.price, l.via]), [[194, 'direct']])
  const res = await searchAll('airpods pro 2', { shops: ['amazon'], io, refPrice: 10_000 })
  assert.deepEqual(res.listings.map(l => [l.price, l.via]), [[10999, 'pricena']])
  assert.equal(res.sources[0].via, 'pricena')
})
