// A recap's own columns and slides (SPEC M2.7): detecting a sheet's columns,
// the Keepsake sample's planted errors, the effective template (order,
// hiding, scenes, added slides, share stats), lenient cells, ranks and what
// reaches a recap.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Papa from 'papaparse'
import { describe, expect, test } from 'vitest'
import { getTemplate, templateFor } from '../shared/templates'
import { changeColumn, cleanColumns, cleanSlides, nextListKey, ownCopyKeys, ownKeyOk, SCENES, scenesFor, slideEntries, storedRankKey, withOwn } from '../shared/templates/own'
import { SCENE_TIMING } from '../shared/utils/scenes'
import type { CustomColumn, SlideSetting, Template } from '../shared/templates/types'
import type { CampaignSettings, RecapPayload } from '../shared/types/recap'
import { applyMapping, autoMap, inferColumn, preselect, settingsForSheet, sheetExtras, type SheetExtra } from '../shared/utils/mapping'
import { normalizeSettings, recapColumns, toRecapRecipient } from '../shared/utils/recap'
import { buildSlides, shareStats } from '../shared/utils/slides'
import { normalizeRaw, validateCell, validateSheet } from '../shared/utils/validate'

const TODAY = '2026-10-11'
const custom = getTemplate('custom')

function csv(file: string) {
  const parsed = Papa.parse<Record<string, string>>(readFileSync(join(__dirname, '..', 'public', file), 'utf8'), { header: true, skipEmptyLines: 'greedy', transform: v => v.trim() })
  return { headers: parsed.meta.fields ?? [], rows: parsed.data }
}

/** What the workspace does with an upload when every offered column is kept. */
function upload(base: Template, file: string, settings: Partial<CampaignSettings> = {}) {
  const { headers, rows } = csv(file)
  const mapping = autoMap(headers, base)
  const used = new Set(Object.values(mapping).filter(Boolean))
  const extras = preselect(sheetExtras(headers, rows, base, settings.columns ?? [], mapping)).filter(e => !used.has(e.header))
  const own = settingsForSheet(base, settings, extras)
  const full = { ...mapping, ...Object.fromEntries(extras.filter(e => e.keep).map(e => [e.key, e.header])) }
  const t = withOwn(base, own)
  const results = validateSheet(applyMapping(rows, full).map(r => normalizeRaw(r, t)), t, { today: TODAY })
  return { extras, own, t, results }
}

function payload(t: Template, data: Record<string, string | number | null>, settings: Partial<CampaignSettings> = {}, ranks: Record<string, number | null> = {}): RecapPayload {
  const s = normalizeSettings({ ...t.defaultSettings, ...settings })
  return {
    template_key: t.key,
    year: 2026,
    business: { name: 'Keepsake', logo_url: null, website_url: null },
    settings: s,
    recipient: toRecapRecipient(t, data, null, { ranks, copy: s.copy }),
  }
}

describe('detecting a sheet\'s columns', () => {
  test('numbers, dates and text, by 80 % of filled cells', () => {
    expect(inferColumn('gifts', ['3', '12', '1,204', '7', 'three', '', '9', '4', '2', '8', '1'])).toEqual({ type: 'int', private: false })
    expect(inferColumn('spent', ['€24.99', '10', '5,50 €', '12.00'])).toEqual({ type: 'decimal', private: false })
    expect(inferColumn('hours', ['3.00', '12', '1.0'])).toEqual({ type: 'int', private: false })
    expect(inferColumn('joined', ['2025-01-10 16:51:26+00', '2026-02-14', '2024-07-16T21:14:02Z'])).toEqual({ type: 'date', private: false })
    expect(inferColumn('occasion', ['Birthday', 'Wedding', '12'])).toEqual({ type: 'text', private: false })
  })

  test('contact details and ids aren\'t pre-ticked; a leading zero isn\'t a quantity', () => {
    expect(inferColumn('Phone', ['+383 44 123 456'])).toMatchObject({ private: true })
    expect(inferColumn('contact', ['ana@example.com', 'liam@example.com'])).toMatchObject({ type: 'text', private: true })
    expect(inferColumn('mobile_number', ['044123456', '049765432'])).toMatchObject({ type: 'text', private: true })
    expect(inferColumn('order_id', ['10001', '10002'])).toMatchObject({ private: true })
    expect(inferColumn('Gifts made', ['3'])).toMatchObject({ private: false })
  })

  test('more than 12 new columns: none pre-ticked', () => {
    const headers = Array.from({ length: 13 }, (_, i) => `stat_${i}`)
    const rows = [Object.fromEntries(headers.map(h => [h, '1']))]
    expect(preselect(sheetExtras(headers, rows, custom, [])).every(e => !e.keep)).toBe(true)
    expect(preselect(sheetExtras(headers.slice(0, 12), rows, custom, [])).every(e => e.keep)).toBe(true)
  })
})

describe('Keepsake sample ("Your own sheet")', () => {
  const { extras, own, t, results } = upload(custom, '/templates/sample-keepsake-150.csv')

  test('id, name and email are template fields; the rest are offered with their types', () => {
    expect(extras.map(e => [e.key, e.type, e.keep])).toEqual([
      ['joined', 'date', true],
      ['gifts_made', 'int', true],
      ['people_gifted', 'int', true],
      ['photos_added', 'int', true],
      ['times_opened', 'int', true],
      ['favorite_occasion', 'text', true],
      ['favorite_style', 'text', true],
      ['first_gift', 'date', true],
      ['maker_badge', 'text', true],
    ])
  })

  test('each kept column gets a slide, in sheet order, with a scene by its name and type', () => {
    expect(own.slides!.map(s => s.key)).toEqual(['c_joined', 'c_gifts_made', 'c_people_gifted', 'c_photos_added', 'c_times_opened', 'c_favorite_occasion', 'c_favorite_style', 'c_first_gift', 'c_maker_badge'])
    expect(t.slides.map(s => s.scene)).toEqual(['date', 'count', 'count', 'count', 'count', 'word', 'word', 'date', 'badge'])
  })

  test('exactly the planted errors; database timestamps read as days', () => {
    const flagged = results.map((r, i) => ({ row: i + 1, errors: r.errors })).filter(r => Object.keys(r.errors).length)
    expect(flagged).toEqual([
      { row: 6, errors: { gifts_made: 'Needs a whole number' } },
      { row: 31, errors: { first_gift: 'Use YYYY-MM-DD' } },
      { row: 102, errors: { customer_id: 'Already used in row 101' } },
    ])
    expect(results[0]!.data).toMatchObject({ customer_id: 'mem_0001', first_name: 'Lea', joined: '2025-01-10', gifts_made: 14 })
  })

  test('the downloadable template\'s rows are clean too', () => {
    const r = upload(custom, '/templates/highreel-template-custom.csv')
    expect(r.results.every(x => !Object.keys(x.errors).length)).toBe(true)
    expect(r.extras.map(e => [e.key, e.type])).toEqual([['visits', 'int'], ['favorite', 'text'], ['first_visit', 'date']])
  })
})

describe('re-uploading', () => {
  const columns: CustomColumn[] = [
    { key: 'gifts_made', label: 'Gifts made', type: 'int' },
    { key: 'favorite_occasion', label: 'Favourite occasion', type: 'text' },
    { key: 'old_stat', label: 'Old stat', type: 'int' },
    { key: 'kept_by_slide', label: 'Kept', type: 'text' },
  ]
  const slides: SlideSetting[] = [
    { key: 'c_gifts_made', column: 'gifts_made', show: 'value', scene: 'days' },
    { key: 'c_favorite_occasion', column: 'favorite_occasion', show: 'value' },
    { key: 'c_kept_by_slide', column: 'kept_by_slide', show: 'value' },
  ]
  const headers = ['customer_id', 'first_name', 'Gifts made', 'favorite_occasion', 'New one']
  const rows = [{ 'customer_id': 'a', 'first_name': 'Ana', 'Gifts made': '3', 'favorite_occasion': 'Birthday', 'New one': 'x' }]

  test('own columns match by name; new ones join with a slide; unused, absent ones go', () => {
    const extras = sheetExtras(headers, rows, custom, columns)
    expect(extras.map(e => [e.header, e.key, e.existing])).toEqual([['Gifts made', 'gifts_made', true], ['favorite_occasion', 'favorite_occasion', true], ['New one', 'new_one', false]])
    const next = settingsForSheet(custom, { columns, slides }, extras)
    expect(next.columns.map(c => c.key)).toEqual(['gifts_made', 'favorite_occasion', 'kept_by_slide', 'new_one'])
    expect(next.slides!.map(s => s.key)).toEqual(['c_gifts_made', 'c_favorite_occasion', 'c_kept_by_slide', 'c_new_one'])
    expect(next.slides![0]).toMatchObject({ scene: 'days' })
  })

  test('unticking one of the recap\'s columns drops it and its slide', () => {
    const extras: SheetExtra[] = sheetExtras(headers, rows, custom, columns).map(e => (e.key === 'favorite_occasion' ? { ...e, keep: false } : e))
    const next = settingsForSheet(custom, { columns, slides }, extras)
    expect(next.columns.map(c => c.key)).not.toContain('favorite_occasion')
    expect(next.slides!.map(s => s.key)).not.toContain('c_favorite_occasion')
  })

  test('a sheet that fits changes nothing', () => {
    const extras = sheetExtras(['customer_id', 'first_name', 'gifts_made'], [{ customer_id: 'a', first_name: 'A', gifts_made: '1' }], custom, columns.slice(0, 1))
    expect(settingsForSheet(custom, { columns: columns.slice(0, 1), slides: slides.slice(0, 1) }, extras)).toEqual({ columns: columns.slice(0, 1), slides: slides.slice(0, 1) })
  })
})

describe('the effective template', () => {
  const app = getTemplate('app')

  test('no own settings: the template itself', () => {
    expect(withOwn(app, { columns: [], slides: null })).toBe(app)
  })

  test('reorder, hide (and its share stat goes), restyle; scenes that don\'t fit are ignored', () => {
    const t = withOwn(app, {
      slides: [
        { key: 'top_feature', scene: 'badge' },
        { key: 'active_days', scene: 'count', tokens: 'hearts' },
        { key: 'streak', hidden: true },
        { key: 'items', scene: 'badge' },
      ],
    })
    expect(t.slides.map(s => s.key)).toEqual(['top_feature', 'active_days', 'items', 'top_percent'])
    expect(t.slides.map(s => s.scene)).toEqual(['badge', 'count', 'count', 'rank'])
    expect(t.slides[1]).toMatchObject({ tokens: 'hearts' })
    expect(t.shareStats.map(s => s.column)).not.toContain('longest_streak_days')
    expect(ownCopyKeys(app, { slides: [{ key: 'streak', hidden: true }] })).toContain('streak')
  })

  test('a template column can get its own slide, and a "top X%" by any number', () => {
    const t = withOwn(app, { slides: [{ key: 'c_sessions', column: 'sessions', show: 'value' }, { key: 'top_sessions', column: 'sessions', show: 'top', max: 10 }] })
    const keys = t.slides.map(s => s.key)
    expect(keys.slice(0, 2)).toEqual(['c_sessions', 'top_sessions'])
    expect(keys.slice(2)).toEqual(app.slides.map(s => s.key))
    expect(t.slides[1]).toMatchObject({ column: 'top_sessions', rankBy: 'sessions', scene: 'rank', max: 10 })
  })

  test('settings that no longer fit are skipped', () => {
    const t = withOwn(custom, {
      columns: [{ key: 'gifts', label: 'Gifts', type: 'int' }, { key: 'first_name', label: 'x', type: 'text' }, { key: 'top_x', label: 'x', type: 'int' }],
      slides: [
        { key: 'c_gone', column: 'gone', show: 'value' },
        { key: 'c_customer_id', column: 'customer_id', show: 'value' },
        { key: 'wrong_key', column: 'gifts', show: 'value' },
        { key: 'top_gifts', column: 'gifts', show: 'top' },
      ],
    })
    expect(t.columns.map(c => c.key)).toEqual(['customer_id', 'first_name', 'email', 'phone', 'personal_note', 'gifts'])
    expect(t.slides.map(s => s.key)).toEqual(['top_gifts'])
  })

  test('column keys can\'t take a template\'s, a placeholder\'s or a rank\'s name', () => {
    expect(ownKeyOk('gifts_made', custom)).toBe(true)
    expect(['first_name', 'customer_id', 'year', 'business', 'top_gifts', 'Gifts', '9lives'].some(k => ownKeyOk(k, custom))).toBe(false)
  })

  test('scenes per kind of data (M2.10: several for each)', () => {
    expect(scenesFor({ kind: 'number' })).toEqual(['count', 'days', 'streak', 'tally', 'fill', 'slots', 'bignumber', 'bubbles', 'gauge', 'climb'])
    expect(scenesFor({ kind: 'number', scene: 'days' })).toEqual(scenesFor({ kind: 'number' }))
    expect(scenesFor({ kind: 'number', decimal: true })).toEqual(['count', 'fill', 'slots', 'bignumber', 'gauge'])
    expect(scenesFor({ kind: 'text' })).toEqual(['word', 'badge', 'sticker', 'typewriter', 'flap', 'neon', 'scatter', 'spotlight'])
    expect(scenesFor({ kind: 'date' })).toEqual(['date', 'postmark', 'word', 'flap', 'typewriter', 'neon'])
    expect(scenesFor({ kind: 'number', rankBy: 'x' })).toEqual(['rank', 'podium', 'leaderboard', 'bignumber', 'gauge'])
    // A template's top % slide stays one when another scene draws it.
    expect(scenesFor({ kind: 'number', scene: 'podium', top: true })).toEqual(scenesFor({ kind: 'number', rankBy: 'x' }))
    expect(scenesFor({ kind: 'text', list: ['a', 'b'] })).toEqual(['timeline', 'receipt', 'cards', 'checklist'])
    // Every scene has a name, a hint and its timing.
    for (const k of Object.keys(SCENES) as (keyof typeof SCENES)[]) {
      expect(SCENES[k].label && SCENES[k].hint).toBeTruthy()
      expect(SCENE_TIMING[k].duration).toBeGreaterThanOrEqual(5000)
    }
    // Stored settings keep the new scenes.
    expect(cleanSlides([{ key: 'a', scene: 'podium' }, { key: 'b', scene: 'receipt' }])).toEqual([{ key: 'a', scene: 'podium' }, { key: 'b', scene: 'receipt' }])
  })

  test('stored settings keep only well-formed entries', () => {
    expect(cleanColumns([{ key: 'ok', type: 'int', label: 'OK' }, { key: 'Bad', type: 'int' }, { key: 'ok', type: 'text' }, { key: 'x', type: 'email' }])).toEqual([{ key: 'ok', label: 'OK', type: 'int' }])
    expect(cleanSlides([{ key: 'a', hidden: true, scene: 'nope', tokens: 'hearts', min: -1, max: 300 }, { key: 'a' }, 'x'])).toEqual([{ key: 'a', hidden: true, tokens: 'hearts' }])
    expect(cleanSlides(undefined)).toBeNull()
  })
})

describe('a recap with its own slides', () => {
  const columns: CustomColumn[] = [
    { key: 'gifts_made', label: 'Gifts made', type: 'int' },
    { key: 'people_gifted', label: 'People gifted', type: 'int' },
    { key: 'first_gift', label: 'First gift', type: 'date' },
    { key: 'favorite_occasion', label: 'Favorite occasion', type: 'text' },
  ]
  const slides: SlideSetting[] = [
    { key: 'c_gifts_made', column: 'gifts_made', show: 'value', tokens: 'hearts' },
    { key: 'c_first_gift', column: 'first_gift', show: 'value' },
    { key: 'top_gifts_made', column: 'gifts_made', show: 'top' },
    { key: 'c_favorite_occasion', column: 'favorite_occasion', show: 'value', label: 'occasion' },
  ]
  const settings = { columns, slides, copy: { c_gifts_made: 'You made {gifts_made} gifts for {people_gifted} people.' } }
  const t = templateFor('custom', settings)
  const row = { customer_id: 'mem_1', first_name: 'Lea', email: 'lea@example.com', gifts_made: 6, people_gifted: 4, first_gift: '2026-02-14', favorite_occasion: 'Anniversary', [storedRankKey('gifts_made')]: 9 }

  test('slides: hearts, a calendar page, a top %, any column in a line', () => {
    const p = payload(t, row, settings)
    const s = buildSlides(t, p)
    expect(s.map(x => x.key)).toEqual(['cover', 'c_gifts_made', 'c_first_gift', 'top_gifts_made', 'c_favorite_occasion', 'share'])
    expect(s[1]).toMatchObject({ scene: 'count', tokens: 'hearts', before: 'You made', value: 6, after: 'gifts for 4 people.' })
    expect(s[2]).toMatchObject({ scene: 'date', date: '2026-02-14', before: 'First gift:', text: 'February 14, 2026' })
    expect(s[3]).toMatchObject({ scene: 'rank', value: 9 })
    expect(s[4]).toMatchObject({ scene: 'word', text: 'Anniversary' })
  })

  test('the preview\'s live rank wins; ranks above the threshold don\'t show', () => {
    expect(buildSlides(t, payload(t, row, settings, { gifts_made: 40 })).map(x => x.key)).not.toContain('top_gifts_made')
  })

  test('the recap gets named columns only: never the id, the email or the raw column behind a rank', () => {
    const cols = recapColumns(t, settings.copy)
    expect(cols).toEqual(expect.arrayContaining(['gifts_made', 'people_gifted', 'first_gift', 'favorite_occasion', 'top_gifts_made']))
    expect(cols).not.toContain('customer_id')
    expect(cols).not.toContain('email')
    const onlyRank = templateFor('custom', { columns, slides: [{ key: 'top_people_gifted', column: 'people_gifted', show: 'top' }] })
    expect(Object.keys(toRecapRecipient(onlyRank, row, null).values)).not.toContain('people_gifted')
  })

  test('share card: the added slides, labels lower-case, dates short', () => {
    expect(shareStats(t, payload(t, row, settings))).toEqual([
      { value: '6', label: 'gifts made' },
      { value: 'Feb 14, 2026', label: 'first gift' },
      { value: 'Top 9%', label: 'for gifts made' },
      { value: 'Anniversary', label: 'occasion' },
    ])
  })

  test('slide entries list hidden slides for Design', () => {
    const entries = slideEntries(custom, { columns, slides: [{ ...slides[0]!, hidden: true }] })
    expect(entries.map(e => [e.def.key, e.hidden])).toEqual([['c_gifts_made', true]])
  })
})

describe('lenient cells (own columns)', () => {
  const t = templateFor('custom', { columns: [{ key: 'n', label: 'n', type: 'int' }, { key: 'd', label: 'd', type: 'date' }, { key: 'x', label: 'x', type: 'decimal' }], slides: null })
  const n = t.columns.find(c => c.key === 'n')!
  const d = t.columns.find(c => c.key === 'd')!
  const x = t.columns.find(c => c.key === 'x')!

  test('decimals: two places, currency signs, decimal commas', () => {
    expect(validateCell(x, '24.999')).toEqual({ value: 25 })
    expect(validateCell(x, '€1,204.55')).toEqual({ value: 1204.55 })
    expect(validateCell(x, '1.204,5 €')).toEqual({ value: 1204.5 })
    expect(validateCell(x, '24,99')).toEqual({ value: 24.99 })
    expect(validateCell(x, '$ 7')).toEqual({ value: 7 })
    expect(validateCell(x, '1.204.000')).toEqual({ value: 1204000 })
    expect(validateCell(x, 'n/a')).toMatchObject({ error: 'Needs a number' })
  })

  test('numbers from other tools', () => {
    expect(validateCell(n, '1,204')).toEqual({ value: 1204 })
    expect(validateCell(n, '24.6')).toEqual({ value: 25 })
    expect(validateCell(n, '1,2')).toEqual({ value: 1 })
    expect(validateCell(n, '€1,204')).toEqual({ value: 1204 })
    expect(validateCell(n, '12%')).toEqual({ value: 12 })
    expect(validateCell(n, 'about 3')).toMatchObject({ error: 'Needs a whole number' })
    expect(validateCell(getTemplate('app').columns.find(c => c.key === 'sessions')!, '24.6')).toMatchObject({ error: 'Needs a whole number' })
  })

  test('dates with a time', () => {
    expect(validateCell(d, '2026-02-14 10:22:01+00')).toEqual({ value: '2026-02-14' })
    expect(validateCell(d, '2026-02-14T10:22:01Z')).toEqual({ value: '2026-02-14' })
    expect(validateCell(d, '2026-02-30 10:00')).toMatchObject({ error: 'Not a real date' })
  })
})

describe('a decimal column on a slide', () => {
  const t = templateFor('custom', { columns: [{ key: 'spent', label: 'Spent', type: 'decimal' }], slides: [{ key: 'c_spent', column: 'spent', show: 'value', scene: 'days' }, { key: 'top_spent', column: 'spent', show: 'top' }] })

  test('only scenes that don\'t count units fit; a calendar asked for is ignored', () => {
    expect(t.slides[0]).toMatchObject({ scene: 'count', decimal: true })
    expect(scenesFor(t.slides[0]!)).toEqual(['count', 'fill', 'slots', 'bignumber', 'gauge'])
  })

  test('the value keeps its decimals on the slide and the share card; it can rank', () => {
    const data = { first_name: 'Ana', spent: 1204.5, [storedRankKey('spent')]: 4 }
    const p = payload(t, data, { columns: [{ key: 'spent', label: 'Spent', type: 'decimal' }], slides: [{ key: 'c_spent', column: 'spent', show: 'value' }, { key: 'top_spent', column: 'spent', show: 'top' }], copy: { c_spent: 'You spent €{spent} with us.' } })
    const s = buildSlides(t, p)
    expect(s.find(x => x.key === 'c_spent')).toMatchObject({ prefix: '€', value: 1204.5, after: 'with us.' })
    expect(s.find(x => x.key === 'top_spent')).toMatchObject({ value: 4 })
    expect(shareStats(t, p)[0]).toEqual({ value: '1,204.5', label: 'spent' })
  })
})

describe('a list of the business\'s own columns (timeline)', () => {
  const columns: CustomColumn[] = [
    { key: 'gifts_made', label: 'Gifts made', type: 'int' },
    { key: 'favorite_occasion', label: 'Favourite occasion', type: 'text' },
    { key: 'first_gift', label: 'first_gift', type: 'date' },
    { key: 'spent', label: 'Spent', type: 'decimal' },
  ]
  const settings = { columns, slides: [{ key: 'list_1', show: 'list' as const, columns: ['favorite_occasion', 'first_gift', 'gifts_made', 'spent', 'customer_id', 'gone'] }] }
  const t = templateFor('custom', settings)

  test('one timeline slide; ids and missing columns are left out', () => {
    expect(t.slides).toHaveLength(1)
    expect(t.slides[0]).toMatchObject({ key: 'list_1', scene: 'timeline', list: ['favorite_occasion', 'first_gift', 'gifts_made', 'spent'], added: true })
    expect(scenesFor(t.slides[0]!)).toEqual(['timeline', 'receipt', 'cards', 'checklist'])
    expect(recapColumns(t)).toEqual(expect.arrayContaining(['favorite_occasion', 'first_gift', 'gifts_made', 'spent']))
  })

  test('each item: the column\'s name, then its value as people read it; blanks are skipped', () => {
    const p = payload(t, { first_name: 'Lea', favorite_occasion: 'Anniversary', first_gift: '2026-02-14', gifts_made: 1204, spent: null }, settings)
    expect(buildSlides(t, p)[1]).toMatchObject({
      scene: 'timeline',
      before: 'Your 2026 at a glance',
      items: [
        { label: 'Favourite occasion', text: 'Anniversary' },
        { label: 'First gift', text: 'February 14, 2026' },
        { label: 'Gifts made', text: '1,204' },
      ],
    })
    expect(shareStats(t, p)).toEqual([])
  })

  test('shown when any column is filled', () => {
    expect(buildSlides(t, payload(t, { first_name: 'Lea', gifts_made: 0 }, settings)).map(s => s.key)).toContain('list_1')
    expect(buildSlides(t, payload(t, { first_name: 'Lea' }, settings)).map(s => s.key)).not.toContain('list_1')
  })

  test('list keys are numbered; stored lists keep up to 5 columns', () => {
    expect(nextListKey([{ key: 'list_1' }, { key: 'c_x' }])).toBe('list_2')
    expect(cleanSlides([{ key: 'list_1', show: 'list', columns: ['a', 'b', 'a', 'Bad', 'c', 'd', 'e', 'f'] }])).toEqual([{ key: 'list_1', show: 'list', columns: ['a', 'b', 'c', 'd', 'e'] }])
    expect(withOwn(custom, { columns, slides: [{ key: 'my_list', show: 'list', columns: ['gifts_made'] }] }).slides).toEqual([])
  })
})

describe('changing a column from the Sheet', () => {
  const columns: CustomColumn[] = [
    { key: 'gifts_made', label: 'Gifts made', type: 'int' },
    { key: 'occasion', label: 'Occasion', type: 'text' },
  ]
  const slides: SlideSetting[] = [
    { key: 'c_gifts_made', column: 'gifts_made', show: 'value', scene: 'days', span: 'visit', tokens: 'hearts', min: 2 },
    { key: 'top_gifts_made', column: 'gifts_made', show: 'top', max: 10 },
    { key: 'list_1', show: 'list', columns: ['occasion', 'gifts_made'] },
    { key: 'c_occasion', column: 'occasion', show: 'value', scene: 'badge' },
  ]

  test('to text: the rank goes, number options go, the list stays', () => {
    const next = changeColumn({ columns, slides }, 'gifts_made', { type: 'text' })
    expect(next.columns[0]).toEqual({ key: 'gifts_made', label: 'Gifts made', type: 'text' })
    expect(next.slides).toEqual([{ key: 'c_gifts_made', column: 'gifts_made', show: 'value' }, slides[2], slides[3]])
  })

  test('to decimal: Count up only, tokens kept, the rank stays', () => {
    const next = changeColumn({ columns, slides }, 'gifts_made', { type: 'decimal' })
    expect(next.slides![0]).toEqual({ key: 'c_gifts_made', column: 'gifts_made', show: 'value', tokens: 'hearts', min: 2 })
    expect(next.slides![1]).toEqual(slides[1])
  })

  test('remove: its slides go and it leaves lists (an emptied list goes too)', () => {
    const next = changeColumn({ columns, slides }, 'gifts_made', { remove: true })
    expect(next.columns.map(c => c.key)).toEqual(['occasion'])
    expect(next.slides).toEqual([{ key: 'list_1', show: 'list', columns: ['occasion'] }, slides[3]])
    expect(changeColumn(next, 'occasion', { remove: true }).slides).toEqual([])
  })
})
