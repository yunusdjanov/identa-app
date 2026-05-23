import type { ApiPatient } from '../types'

export interface PatientSection {
  title: string
  data: ApiPatient[]
}

// Phonetic map: Cyrillic & extended Uzbek letters → Latin equivalent.
// Lets "Иван" appear in the "I" section instead of after Z.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  // Russian
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'Y', Ж: 'J', З: 'Z',
  И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R',
  С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'X', Ц: 'C', Ч: 'C', Ш: 'S', Щ: 'S',
  Ъ: '#', Ы: 'I', Ь: '#', Э: 'E', Ю: 'Y', Я: 'Y',
  // Uzbek Cyrillic extras
  Ў: 'O', Қ: 'Q', Ғ: 'G', Ҳ: 'H',
}

function normalizeFirstLetter(name: string): string {
  const c = name.trim().charAt(0).toUpperCase()
  if (!c) return '#'

  // Map Cyrillic → Latin phonetic equivalent so the alphabet stays unified
  if (CYRILLIC_TO_LATIN[c]) return CYRILLIC_TO_LATIN[c]

  // Latin letter? Keep it
  if (/[A-Z]/.test(c)) return c

  // Anything else (digits, symbols) → '#'
  return '#'
}

// Group patients alphabetically (iOS Contacts style). Cyrillic names are
// folded into their Latin equivalent so "Иван" appears in section "I" and
// "Сардор" in "S" — instead of trailing after Z.
export function groupPatientsByLetter(patients: ApiPatient[]): PatientSection[] {
  const groups: Record<string, ApiPatient[]> = {}

  for (const p of patients) {
    const letter = normalizeFirstLetter(p.full_name)
    if (!groups[letter]) groups[letter] = []
    groups[letter].push(p)
  }

  return Object.keys(groups)
    .sort((a, b) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b, 'en')
    })
    .map((letter) => ({
      title: letter,
      data: groups[letter]!.sort((a, b) => a.full_name.localeCompare(b.full_name, 'en')),
    }))
}
