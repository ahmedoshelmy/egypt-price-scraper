// Shops that can't be read over plain HTTP: only Pricena's copy of their offers.
import type { ShopDef } from '../types.js'

const enc = encodeURIComponent

export const carrefour: ShopDef = {
  id: 'carrefour', name: 'Carrefour', domain: 'carrefouregypt.com',
  categories: ['phones', 'appliances', 'electronics', 'furniture', 'laptops'], mode: 'pricena', pricenaName: /carrefour/i,
  searchUrl: q => `https://www.carrefouregypt.com/mafegy/en/search?keyword=${enc(q)}`,
  note: 'Not read directly. Pricena stopped listing it in Oct 2026, so usually just a link.',
}

// Its product search API answers 403 and the site loads a Turnstile challenge.
export const sigma: ShopDef = {
  id: 'sigma', name: 'Sigma Computer', domain: 'sigma-computer.com',
  categories: ['laptops', 'electronics'], mode: 'pricena', pricenaName: /sigma/i,
  searchUrl: q => `https://www.sigma-computer.com/en/search?q=${enc(q)}`,
  note: 'Search API is behind Cloudflare Turnstile; Pricena only.',
}

// A Vercel bot checkpoint (429) answers plain HTTP clients; only a real browser gets the site.
export const dubaiphone: ShopDef = {
  id: 'dubaiphone', name: 'Dubai Phone', domain: 'dubaiphone.net',
  categories: ['phones', 'laptops', 'electronics'], mode: 'pricena', pricenaName: /dubai\s*phone/i,
  searchUrl: q => `https://www.dubaiphone.net/en/category/all?search=${enc(q)}`,
  note: 'Needs a headless browser (Vercel checkpoint); Pricena only.',
}
