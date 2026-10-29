#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { searchAll } from './search.js'
import { SHOPS, shopsFor } from './shops/index.js'
import type { ShopCategory } from './types.js'

const HELP = `Usage: egypt-price-scraper [options] <product words…>

Search Egyptian online shops for one product and list prices (EGP), cheapest first.

Options:
  --shops <ids>      Comma-separated shop ids (default: all). See --list-shops.
  --category <c>     Only shops selling: laptops, phones, appliances, electronics, furniture
  --json             Print the full result as JSON
  --raw              Keep every listing, not only titles that match the query
  --ref-price <egp>  Roughly what it costs: drops listings below 0.3x or above 3x (clones, bundles)
  --no-pricena       Don't use eg.pricena.com (fallback and Pricena-only shops)
  --timeout <s>      Seconds per shop (default 25)
  --list-shops       Print the supported shops and exit
  -h, --help         This help

Example: egypt-price-scraper --shops btech,noon,amazon "iphone 16 pro 256gb"`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    shops: { type: 'string' }, category: { type: 'string' }, json: { type: 'boolean' }, raw: { type: 'boolean' },
    'no-pricena': { type: 'boolean' }, 'ref-price': { type: 'string' }, timeout: { type: 'string' }, 'list-shops': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  },
})

const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 2 }))
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n))

async function main() {
  if (values.help) return void console.log(HELP)
  if (values['list-shops']) {
    for (const s of SHOPS) console.log(`${s.id.padEnd(16)} ${s.name.padEnd(22)} ${s.mode.padEnd(8)} ${s.note ?? ''}`)
    return
  }
  const query = positionals.join(' ').trim()
  if (!query) { console.error(HELP); process.exitCode = 2; return }

  let shops = values.shops ? values.shops.split(',').map(s => s.trim()).filter(Boolean) : undefined
  if (values.category) {
    const inCat = shopsFor(values.category as ShopCategory)
    if (!inCat.length) throw new Error(`Unknown category "${values.category}"`)
    shops = shops ? shops.filter(s => inCat.includes(s)) : inCat
  }
  const res = await searchAll(query, {
    shops,
    match: values.raw ? false : undefined,
    pricena: !values['no-pricena'],
    refPrice: values['ref-price'] ? Number(values['ref-price']) : null,
    timeoutMs: values.timeout ? Number(values.timeout) * 1000 : undefined,
  })
  if (values.json) return void console.log(JSON.stringify(res, null, 2))

  const width = Math.max(60, process.stdout.columns || 120)
  const titleW = Math.max(20, Math.min(70, width - 12 - 16 - 6))
  if (!res.listings.length) console.log(`No listings matched "${query}".`)
  else {
    console.log(`${'EGP'.padStart(11)}  ${'Shop'.padEnd(16)}  ${'Title'.padEnd(titleW)}  Link`)
    for (const l of res.listings) {
      const note = l.sold === 'Out of stock' ? ' (out of stock)' : l.via === 'pricena' ? ' (via Pricena)' : ''
      console.log(`${fmt(l.price).padStart(11)}  ${cut(l.store, 16)}  ${cut(l.title + note, titleW)}  ${l.url}`)
    }
  }
  const by = (st: string) => res.sources.filter(s => s.status === st).map(s => s.store)
  console.log(`\nfound: ${by('found').join(', ') || '—'}`)
  console.log(`none: ${by('none').join(', ') || '—'}`)
  if (by('failed').length) console.log(`failed: ${by('failed').join(', ')}`)
  if (by('blocked').length) console.log(`blocked: ${by('blocked').join(', ')}`)
}

main().catch(e => { console.error(e?.message ?? e); process.exitCode = 1 })
