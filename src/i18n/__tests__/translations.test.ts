import fs from 'fs'
import path from 'path'

import { translations } from '../translations'

type FlatDictionary = Map<string, string>

function flatten(
  value: Record<string, unknown>,
  prefix = '',
  output: FlatDictionary = new Map()
): FlatDictionary {
  Object.entries(value).forEach(([key, entry]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof entry === 'string') {
      output.set(fullKey, entry)
    } else if (entry && typeof entry === 'object') {
      flatten(entry as Record<string, unknown>, fullKey, output)
    }
  })
  return output
}

function interpolationKeys(value: string): string[] {
  return Array.from(value.matchAll(/\{\{(\w+)\}\}/g))
    .map((match) => match[1]!)
    .sort()
}

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(target)
    }
    return /\.tsx?$/.test(entry.name) ? [target] : []
  })
}

describe('translation integrity', () => {
  const dictionaries = {
    uz: flatten(translations.uz as unknown as Record<string, unknown>),
    ru: flatten(translations.ru as unknown as Record<string, unknown>),
    en: flatten(translations.en as unknown as Record<string, unknown>),
  }

  it('keeps the same key set and interpolation variables in every locale', () => {
    const expectedKeys = Array.from(dictionaries.uz.keys()).sort()

    expect(Array.from(dictionaries.ru.keys()).sort()).toEqual(expectedKeys)
    expect(Array.from(dictionaries.en.keys()).sort()).toEqual(expectedKeys)

    expectedKeys.forEach((key) => {
      const expectedVariables = interpolationKeys(dictionaries.uz.get(key)!)
      expect(interpolationKeys(dictionaries.ru.get(key)!)).toEqual(expectedVariables)
      expect(interpolationKeys(dictionaries.en.get(key)!)).toEqual(expectedVariables)
    })
  })

  it('defines every statically referenced t() key in every locale', () => {
    const srcRoot = path.resolve(__dirname, '../..')
    const referencedKeys = new Set<string>()
    const staticCall = /\bt\(\s*(['"])([^'"]+)\1/g

    sourceFiles(srcRoot).forEach((file) => {
      const source = fs.readFileSync(file, 'utf8')
      for (const match of source.matchAll(staticCall)) {
        const key = match[2]!
        if (/^[\w.-]+$/.test(key)) referencedKeys.add(key)
      }
    })

    const missing = Array.from(referencedKeys)
      .flatMap((key) =>
        (['uz', 'ru', 'en'] as const)
          .filter((locale) => !dictionaries[locale].has(key))
          .map((locale) => `${locale}:${key}`)
      )
      .sort()

    expect(missing).toEqual([])
  })

  it('does not ship paused appearance and notification settings copy', () => {
    ;(['uz', 'ru', 'en'] as const).forEach((locale) => {
      expect(dictionaries[locale].has('settings.rows.appearance')).toBe(false)
      expect(dictionaries[locale].has('settings.rows.notifications')).toBe(false)
      expect(dictionaries[locale].has('settings.appearanceSheet.title')).toBe(false)
      expect(dictionaries[locale].has('settings.notificationsSheet.title')).toBe(false)
      expect(dictionaries[locale].has('notify.reminderTitle')).toBe(false)
    })
  })
})
