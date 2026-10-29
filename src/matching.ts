import type { Listing } from './types.js'

// Does a listing title name the searched product? Heuristics tuned on
// Egyptian shop titles: accessories, dearer variants and price outliers out.

const STOP = new Set(['the', 'a', 'an', 'and', 'with', 'for', 'of', 'in', 'smart', 'smartwatch', 'watch', 'egypt', 'new', 'original'])
/** Words that name a different, usually dearer, model when they follow the model name. */
const VARIANTS = new Set(['pro', 'plus', 'max', 'ultra', 'lite', 'mini', 'se', 'fe', 'neo', 'prime', 'active', 'gt', 'xl', 'classic', 'edge']) // "Amazfit Active Edge" isn't the Active
const ACCESSORY = /\b(straps?|protector|film|charger|cable|case|cover|bumper|holder|stand|pouch|tempered glass)\b/g
/** "with travel case", "aluminium alloy case", "extra fabric strap": part of the product, not sold for it. */
const INCLUDED = /\b(with|extra|and|plus|included|includes|alloy|metal|aluminium|aluminum|titanium|leather|silicone)\b(\s+\S+){0,3}\s*$|\+\s*$/

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** A listing sold for the product rather than the product itself. */
export function isAccessory(title: string, toks: string[]): boolean {
  const t = title.toLowerCase()
  if (/\b(replacement|spare|refill)s? for\b/.test(t)) return true
  // "Compatible with Samsung Galaxy A55 … Case", "For Huawei Watch GT 6 Strap".
  if (/^\s*(compatible (with|for)|for|replacement)\b/.test(t)) return true
  // "Compatible with Huawei Band 10" is an accessory; "compatible with iOS Android" is not.
  for (const m of t.matchAll(/compatible (?:with|for)\s+([^,;|]{0,40})/g)) {
    if (toks.some(tok => words(m[1]).includes(tok))) return true
  }
  for (const m of t.matchAll(ACCESSORY)) {
    if (toks.includes(m[1])) continue
    const before = t.slice(Math.max(0, m.index! - 40), m.index)
    if (/\bfor\s*$/.test(before)) return true
    // "Silicone Strap for Huawei Watch GT 6", "Case Compatible with…": made for the product.
    // ("Case forApple AirPods": shop titles glue words together.)
    if (/^\w*\s+(?:for\b|for(?=apple|iphone|samsung|galaxy|huawei|xiaomi|airpods)|compatible\b)/.test(t.slice(m.index!))) return true
    // "AirPods Pro 2 Silicone Case": a soft case or cover is sold for the product
    // (a watch's "aluminium alloy case" is its body; a "silicone strap" comes with it).
    if (/^(?:case|cover)$/.test(m[1]) && /\b(silicone|leather|tpu|protective|clear)\s*$/.test(before) && !/\bwith\b/.test(before)) return true
    // A list of what's in the box: "with 3 extras: precision head, Venus razor, zip pouch".
    const wider = t.slice(Math.max(0, m.index! - 90), m.index)
    if (INCLUDED.test(before) || (/\bwith\b/.test(wider) && !/\bfor\b/.test(wider))) continue
    return true
  }
  return false
}

/** Query words that must all appear in a listing title. */
export function queryTokens(query: string): string[] {
  return words(query).filter(w => !STOP.has(w))
}

/**
 * A size typed as one word ("140cm") is in the title as a size: "140 cm",
 * "140cm" or one side of "77x140x50 cm" / "160×60×140 cm" (furniture titles).
 */
function hasSize(title: string, tok: string): boolean {
  const m = tok.match(/^(\d+(?:\.\d+)?)(cm|mm)$/)
  if (!m) return false
  for (const g of title.toLowerCase().matchAll(/\d+(?:\.\d+)?(?:\s*[x×*]\s*\d+(?:\.\d+)?)*\s*(cm|mm)\b/g)) {
    if (g[1] === m[2] && (g[0].match(/\d+(?:\.\d+)?/g) ?? [] as string[]).includes(m[1])) return true
  }
  return false
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** "watch8" also matches "watch 8" and "watch-8". */
const loose = (t: string) => escapeRe(t).replace(/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/g, '[\\s-]*')

/**
 * Does this listing title name the queried product? Every query word must
 * appear (model codes may be split or joined: "BHS 378" ↔ "BHS378"; "Fit 4"
 * ↔ "FIT4"). Rejects accessories for the product and dearer variants
 * ("Fit 4 Pro" when the query is "Fit 4"; "Pro-level sleep" does not count).
 */
export function titleMatches(title: string, query: string): boolean {
  const toks = queryTokens(query)
  if (!toks.length) return false
  const tw = words(title)
  const joined = tw.join('')
  // Brands glued to the next word still count: "Philipsshaver 3000X".
  const has = (t: string) => /^\d+$/.test(t)
    ? tw.includes(t)
    : tw.includes(t) || (/\d/.test(t) && joined.includes(t)) || (t.length >= 4 && !/\d/.test(t) && tw.some(w => w.startsWith(t)))
  // Joining neighbours lets "fit 4" match "FIT4" and "bhs 378" match "BHS378".
  for (let i = 0; i < toks.length; i++) {
    if (has(toks[i]) || hasSize(title, toks[i])) continue
    const pair = i + 1 < toks.length ? toks[i] + toks[i + 1] : null
    const prev = i > 0 ? toks[i - 1] + toks[i] : null
    if ((pair && tw.includes(pair)) || (prev && tw.includes(prev))) continue
    if (/\d/.test(toks[i]) && joined.includes(toks[i])) continue
    return false
  }

  // A bare number belongs to the word before it: "Band 10" must not match
  // "Band 9 … 10-day battery".
  // The word before it is taken from the query as typed ("Watch 5", not "Redmi 5"),
  // and a letter right after the number is another model ("Nova 2R" isn't "Nova 2").
  const raw0 = title.toLowerCase()
  const qw = words(query)
  for (let i = 1; i < qw.length; i++) {
    if (!/^\d+$/.test(qw[i])) continue
    // One filler word may sit between: "Oraimo 4 Plus" ↔ "Oraimo Watch 4 Plus".
    const prevKept = [...qw.slice(0, i)].reverse().find(w => !STOP.has(w))
    const near = (w: string) => new RegExp(`\\b${escapeRe(w)}\\w*[\\s\\-_]{0,2}(?:(?:watch|smart|series|band)[\\s\\-_]{0,2})?${qw[i]}(?![\\da-z])`).test(raw0)
    if (!near(qw[i - 1]) && !(prevKept && near(prevKept))) return false
  }

  // A bare number right after the model name is another model: "CMF Watch Pro 2" isn't
  // "CMF Watch Pro" (sizes like "44 mm" or "1.43 inch" don't count).
  {
    const lastQ = toks[toks.length - 1]
    const after = raw0.match(new RegExp(`\\b${loose(lastQ)}\\s+(\\d+)(?![\\d.,]*[\\s-]*(?:mm|millimeter|inch|in\\b|"|”|mah|days?|hours?|hrs?|w\\b|%|gb|cm|k\\b|g\\b))`))
    if (after && !toks.includes(after[1])) return false
  }

  // Variant directly after the last query word (or its joined form).
  const last = toks[toks.length - 1]
  const lastJoined = toks.length > 1 ? toks[toks.length - 2] + last : last
  const raw = title.toLowerCase()
  for (const v of VARIANTS) {
    if (toks.includes(v)) continue
    const re = new RegExp(`\\b(?:${loose(last)}|${loose(lastJoined)})\\s*${v}\\b(?!-)`)
    if (re.test(raw)) return false
  }

  return !isAccessory(title, toks)
}

/** Sizes and colours aside, does the title name the product? ("Apple iPhone 17 Pro Max" for "iPhone 17 Pro Max 256GB"). */
export function sameModel(title: string, query: string): boolean {
  const bare = query.replace(/\b\d+(?:\.\d+)?\s?(?:gb|tb)\b(\s+ram\b)?/gi, ' ').replace(/\s+/g, ' ').trim()
  return !!bare && bare !== query.trim() && titleMatches(title, bare)
}

/**
 * Keep listings that name the product, drop price outliers (an accessory
 * that slipped past the title check costs a fraction of the real thing),
 * and keep one listing per URL.
 */
export function filterListings(listings: Listing[], query: string, refPrice: number | null = null, match: (title: string) => boolean = t => titleMatches(t, query)): Listing[] {
  // Far from the price you were quoted means a different product (an accessory, a bundle, another tier).
  const near = (p: number | null) => p == null || refPrice == null || (p >= refPrice * 0.3 && p <= refPrice * 3)
  const matched = listings.filter(l => match(l.title) && near(l.price))
  const prices = matched.map(l => l.price).filter((p): p is number => p != null).sort((a, b) => a - b)
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null
  // The same product listed twice by one shop (a colour variant without a
  // price, sharing the rating): keep the one with a price.
  const sameKey = (l: Listing) => `${l.source}|${l.title.toLowerCase().slice(0, 60)}|${l.ratingCount ?? ''}`
  const priced = new Set(matched.filter(l => l.price != null).map(sameKey))
  const seen = new Set<string>()
  return matched.filter(l => {
    if (median && l.price != null && prices.length >= 3 && (l.price < median * 0.35 || l.price > median * 3)) return false
    if (l.price == null && priced.has(sameKey(l))) return false
    const key = `${l.source}|${l.url}|${l.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Most-reviewed listing per shop first, then cheapest. */
export function rankListings(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => (b.ratingCount ?? -1) - (a.ratingCount ?? -1) || (a.price ?? Infinity) - (b.price ?? Infinity))
}
