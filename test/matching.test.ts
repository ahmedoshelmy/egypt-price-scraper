import { test } from 'node:test'
import assert from 'node:assert/strict'
import { titleMatches, isAccessory, queryTokens, sameModel, filterListings, rankListings } from '../src/matching.js'
import type { Listing } from '../src/types.js'

const L = (title: string, price: number | null, extra: Partial<Listing> = {}): Listing => ({
  source: 'x', store: 'X', title, url: `https://x/${encodeURIComponent(title)}`, storeSearchUrl: null,
  price, rating: null, ratingCount: null, sold: null, image: null, ...extra,
})

test('every query word must appear; codes may be split or joined', () => {
  assert.ok(titleMatches('Philips BHS378 Hair Straightener', 'philips bhs 378'))
  assert.ok(titleMatches('Huawei Watch FIT4 Black', 'huawei watch fit 4'))
  assert.ok(titleMatches('Xiaomi Redmi Note 14 Pro Plus - 12GB RAM - 512GB', 'redmi note 14 pro plus'))
  assert.ok(!titleMatches('Xiaomi Redmi Note 13 Pro', 'redmi note 14 pro'))
  assert.ok(!titleMatches('anything', ''))
})

test('a dearer variant right after the model is another product', () => {
  assert.ok(!titleMatches('Huawei Watch Fit 4 Pro', 'huawei watch fit 4'))
  assert.ok(titleMatches('Huawei Watch Fit 4 Pro', 'huawei watch fit 4 pro'))
  assert.ok(!titleMatches('Apple iPhone 16 Plus 128GB', 'iphone 16'))
  assert.ok(!titleMatches('CMF Watch Pro 2', 'cmf watch pro'))
  // A size after the model isn't a model number.
  assert.ok(titleMatches('Amazfit Bip 6 46 mm Black', 'amazfit bip 6'))
})

test('a bare number belongs to the word before it', () => {
  assert.ok(!titleMatches('Xiaomi Smart Band 9 with 10-day battery', 'xiaomi band 10'))
  assert.ok(titleMatches('Xiaomi Smart Band 10 Black', 'xiaomi band 10'))
})

test('accessories for the product are rejected, included parts are not', () => {
  const toks = queryTokens('airpods pro 2')
  assert.ok(isAccessory('Silicone Case for AirPods Pro 2', toks))
  assert.ok(isAccessory('Compatible with Apple AirPods Pro 2 Strap', toks))
  assert.ok(isAccessory('Replacement Ear Tips for AirPods Pro 2', toks))
  assert.ok(!isAccessory('Apple AirPods Pro 2 with MagSafe Charging Case', toks))
  assert.ok(!titleMatches('AirPods Pro 2 Case Cover - Full Body Protective Silicone Case Compatible with Apple', 'airpods pro 2'))
  assert.ok(titleMatches('Apple AirPods Pro 2 (USB-C) with MagSafe Case', 'airpods pro 2'))
})

test('sizes typed as one word match furniture dimensions', () => {
  assert.ok(titleMatches('MICKE Desk, white, 105x50 cm', 'micke desk 105cm'))
  assert.ok(!titleMatches('MICKE Desk, white, 73x50 cm', 'micke desk 105cm'))
})

test('sameModel ignores storage sizes', () => {
  assert.ok(sameModel('Apple iPhone 16', 'iphone 16 128gb'))
  assert.ok(!sameModel('Apple iPhone 16', 'iphone 16')) // nothing stripped: not a "same model" case
  assert.ok(!sameModel('Apple iPhone 16 Plus', 'iphone 16 128gb'))
})

test('filterListings: matches only, price outliers and duplicates out', () => {
  const ls = [
    L('Apple AirPods Pro 2', 10999),
    L('Apple AirPods Pro 2 USB-C', 11500),
    L('Apple AirPods Pro 2 MagSafe', 10800),
    L('Apple AirPods Pro 2 Clone', 900), // < 35% of the median
    L('Apple AirPods Pro 2', 10999), // same URL+title
    L('Silicone Case for AirPods Pro 2', 150),
    L('Apple AirPods 4', 6000),
  ]
  const out = filterListings(ls, 'airpods pro 2')
  assert.deepEqual(out.map(l => l.price), [10999, 11500, 10800])
  // A quoted price drops listings far from it.
  assert.deepEqual(filterListings([L('Apple AirPods Pro 2', 10999), L('Apple AirPods Pro 2 B', 40000)], 'airpods pro 2', 11000).map(l => l.price), [10999])
  // A custom matcher.
  assert.deepEqual(filterListings(ls, 'airpods pro 2', null, () => true).map(l => l.price), [10999, 11500, 10800, 6000]) // dedupe + outliers still apply
})

test('rankListings: most reviewed first, then cheapest', () => {
  const out = rankListings([L('a', 300), L('b', 100, { ratingCount: 5 }), L('c', 200), L('d', 900, { ratingCount: 50 })])
  assert.deepEqual(out.map(l => l.title), ['d', 'b', 'c', 'a'])
})

import { CASES, MORE_CASES } from './fixtures/matchingCases.js'

test('titleMatches on real shop titles (regression corpus)', () => {
  for (const [q, title, want] of [...CASES, ...MORE_CASES]) assert.equal(titleMatches(title, q), want, `${q} | ${title}`)
})
