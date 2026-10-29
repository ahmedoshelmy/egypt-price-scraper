import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('./fixtures/', import.meta.url))
export const fixture = (name: string) => readFileSync(dir + name, 'utf8')
