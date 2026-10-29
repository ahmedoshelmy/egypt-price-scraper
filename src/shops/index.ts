// The shop registry. To add a shop: write ./<shop>.ts exporting a ShopDef
// (with a parser you can test offline) and list it in SHOPS.

import type { ShopCategory, ShopDef } from '../types.js'
import { amazon } from './amazon.js'
import { btech } from './btech.js'
import { twoB } from './twob.js'
import { noon } from './noon.js'
import { jumia } from './jumia.js'
import { compumarts } from './compumarts.js'
import { dream2000 } from './dream2000.js'
import { raya } from './raya.js'
import { raneen } from './raneen.js'
import { hyperone } from './hyperone.js'
import { kimostore } from './kimostore.js'
import { elnekhely } from './elnekhely.js'
import { elbadr } from './elbadr.js'
import { maximumhardware } from './maximumhardware.js'
import { egyptlaptop } from './egyptlaptop.js'
import { ikea } from './ikea.js'
import { homzmart } from './homzmart.js'
import { carrefour, sigma, dubaiphone } from './pricenaOnly.js'

/** Every shop, in table order. */
export const SHOPS: ShopDef[] = [
  btech, twoB, amazon, noon, jumia, carrefour,
  compumarts, sigma, dream2000, dubaiphone,
  raya, raneen, hyperone, kimostore,
  elnekhely, elbadr, maximumhardware, egyptlaptop,
  ikea, homzmart,
]

export const shopById = (id: string) => SHOPS.find(s => s.id === id)

/** Ids of the shops that sell a kind of product. */
export const shopsFor = (category: ShopCategory) => SHOPS.filter(s => s.categories.includes(category)).map(s => s.id)

const KINDS: [ShopCategory, RegExp][] = [
  ['laptops', /\b(laptops?|notebooks?|macbook|ideapad|thinkpad|thinkbook|yoga|legion|loq|vivobook|zenbook|rog|tuf|expertbook|inspiron|vostro|latitude|xps|pavilion|victus|omen|elitebook|probook|envy|aspire|nitro|swift|predator|modern \d+|katana|thin gf|galaxy book|desktop|all[- ]in[- ]one|monitor|graphics card|rtx|ssd|motherboard)\b/i],
  ['phones', /\b(phones?|iphone|ipad|tablet|galaxy (a|s|z|m|tab)\s?\d*|redmi|xiaomi|poco|oppo|realme|vivo|honor|pixel|infinix|tecno|nokia|oneplus|motorola|reno|note \d+|a\d{2}\b)/i],
  ['furniture', /\b(desks?|chairs?|tables?|sofas?|couch|beds?|wardrobes?|shelf|shelves|shelving|cabinets?|drawers?|dressers?|nightstands?|mattress(es)?|bookcases?|ottomans?|stools?|armchairs?|rugs?|carpets?|curtains?|lamps?|tv (unit|stand)|bean ?bag|cm)\b/i],
  ['appliances', /\b(fridge|refrigerator|freezer|no ?frost|washer|washing|dryer|dishwasher|oven|cooker|stove|microwave|air ?conditioner|split|heater|vacuum|fan|kettle|blender|mixer|toaster|air ?fryer|straightener|hair ?dryer|shavers?|shaving|trimmers?|groomers?|grooming|epilators?|clippers?|oneblade|bodygroom|multigroom|braun series \d|silk[- ]?[eé]pil|iron|water ?dispenser|\d{3}\s?l(iter|itre)?\b)/i],
  ['electronics', /\b(tv|television|smart ?watch|watch|band|earbuds|airpods|headphones?|headset|speaker|keyboards?|mouse|mice|redragon|logitech|razer|hyperx|corsair|steelseries|keychron|fantech|rapoo|router|camera|playstation|ps5|xbox|charger|power ?bank)\b/i],
]

/** A guess at what kind of product a query names, or null. */
export function inferCategory(query: string): ShopCategory | null {
  for (const [kind, re] of KINDS) if (re.test(query)) return kind
  return null
}
