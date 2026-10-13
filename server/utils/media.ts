// Logos and group photos in R2 (SPEC M2.14 P2). One private bucket (`MEDIA`);
// the first folder of every key is the owning business:
//   {business_id}/logo/{uuid}.png
//   {business_id}/{campaign_id}/{uuid}.{webp|jpg|png}
//   {business_id}/{campaign_id}/og/{token}-{hash}.png   (link previews, og.png)
// Files reach browsers through /media/{key}?exp=…&sig=…: an HMAC of the key and
// the expiry, checked by server/routes/media/[...path].get.ts. The workspace
// signs for 1 h and recap pages for 24 h, with the expiry rounded up to the
// hour so an image keeps one URL for a while and the browser caches it.

import type { R2Bucket } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'
import type { Business, CampaignSettings } from '#shared/types/recap'

/** A logo or photo key (link previews aren't served from /media). */
export const MEDIA_KEY = /^[0-9a-f-]{36}\/(?:logo|[0-9a-f-]{36})\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024

const TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const
export type MediaExt = keyof typeof TYPES
const mediaType = (key: string): string => TYPES[key.split('.').pop() as MediaExt] ?? 'application/octet-stream'

/** What the first bytes say the file is: PNG, JPEG or WebP, else null. */
export function sniffImage(bytes: Uint8Array): MediaExt | null {
  const at = (i: number, ...b: number[]) => b.every((v, j) => bytes[i + j] === v)
  if (at(0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
    return 'png'
  if (at(0, 0xFF, 0xD8, 0xFF))
    return 'jpg'
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50))
    return 'webp'
  return null
}

let cached: { from: string, key: Promise<CryptoKey> } | null = null

function signingKey(event: H3Event): Promise<CryptoKey> {
  const material = `media:${secretMaterial(event)}`
  if (cached?.from !== material) {
    cached = {
      from: material,
      key: crypto.subtle.importKey('raw', new TextEncoder().encode(material), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']),
    }
  }
  return cached.key
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

async function signature(event: H3Event, key: string, exp: number): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await signingKey(event), new TextEncoder().encode(`${key}\n${exp}`))
  return hex(mac).slice(0, 32)
}

/** A link to one file, valid for at least `expiresIn` seconds. */
async function mediaUrl(event: H3Event, key: string, expiresIn: number): Promise<string> {
  const exp = Math.ceil((Date.now() / 1000 + expiresIn) / 3600) * 3600
  return `/media/${key}?exp=${exp}&sig=${await signature(event, key, exp)}`
}

/** Whether a /media link is genuine and unexpired. */
export async function mediaLinkOk(event: H3Event, key: string, exp: number, sig: string): Promise<boolean> {
  if (!MEDIA_KEY.test(key) || !Number.isInteger(exp) || exp * 1000 < Date.now() || !/^[0-9a-f]{32}$/.test(sig))
    return false
  const expected = await signature(event, key, exp)
  // Compare without an early exit.
  let diff = 0
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

/** Fill in logo_url and the photos' urls. */
export async function signMedia(event: H3Event, business: Business, settings: CampaignSettings, expiresIn: number) {
  const [logo, ...photos] = await Promise.all([
    business.logo_path ? mediaUrl(event, business.logo_path, expiresIn) : null,
    ...settings.photos.map(p => mediaUrl(event, p.path, expiresIn)),
  ])
  return {
    business: { ...business, logo_url: logo ?? null } as Business,
    settings: { ...settings, photos: settings.photos.map((p, i) => ({ ...p, url: photos[i]! })) } as CampaignSettings,
  }
}

/** Store one file under `key`. */
export async function putMedia(event: H3Event, key: string, bytes: Uint8Array | ArrayBuffer, type = mediaType(key)) {
  await bindings(event).MEDIA.put(key, bytes, { httpMetadata: { contentType: type } })
}

/** One file's bytes and type, or null. */
export async function getMedia(event: H3Event, key: string): Promise<{ data: Uint8Array, type: string } | null> {
  const object = await bindings(event).MEDIA.get(key)
  if (!object)
    return null
  return { data: new Uint8Array(await object.arrayBuffer()), type: object.httpMetadata?.contentType ?? mediaType(key) }
}

export async function deleteMedia(event: H3Event, keys: string[]) {
  // R2 deletes up to 1,000 keys per call.
  for (let i = 0; i < keys.length; i += 1000)
    await bindings(event).MEDIA.delete(keys.slice(i, i + 1000))
}

/** Every key under a prefix ("{business_id}/{campaign_id}/"). */
export async function listMedia(event: H3Event, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined
  do {
    const page = await bindings(event).MEDIA.list({ prefix, cursor, limit: 1000 })
    keys.push(...page.objects.map(o => o.key))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return keys
}

/** Remove every file under a folder (a campaign's photos and link previews). */
export async function removeFolder(event: H3Event, folder: string) {
  await removeFolderIn(bindings(event).MEDIA, folder)
}

/** The same, given the bucket (code that runs without a request: sign-in hooks, scheduled jobs). */
export async function removeFolderIn(bucket: R2Bucket, folder: string) {
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix: `${folder}/`, cursor, limit: 1000 })
    if (page.objects.length)
      await bucket.delete(page.objects.map(o => o.key))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
}
