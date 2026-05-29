import { groupPatientsByLetter } from '../groupPatients'
import type { ApiPatient } from '../../types'

const p = (id: string, name: string): ApiPatient => ({
  id,
  patient_id: id,
  full_name: name,
  phone: '+998901234567',
})

describe('groupPatientsByLetter', () => {
  it('groups by uppercase first letter', () => {
    const sections = groupPatientsByLetter([
      p('1', 'Aziz Karimov'),
      p('2', 'Anvar Tursunov'),
      p('3', 'Bekzod Rasulov'),
    ])
    expect(sections.map((s) => s.title)).toEqual(['A', 'B'])
    expect(sections[0].data).toHaveLength(2)
  })

  it('sorts sections alphabetically', () => {
    const sections = groupPatientsByLetter([
      p('1', 'Zilola'),
      p('2', 'Anvar'),
      p('3', 'Madina'),
    ])
    expect(sections.map((s) => s.title)).toEqual(['A', 'M', 'Z'])
  })

  it('folds Cyrillic names into Latin equivalents (Иван → I, Сардор → S)', () => {
    const sections = groupPatientsByLetter([
      p('1', 'Иван Петров'),
      p('2', 'Сардор Mirzaev'),
    ])
    expect(sections.find((s) => s.title === 'I')).toBeDefined()
    expect(sections.find((s) => s.title === 'S')).toBeDefined()
  })

  it('sends digits/symbols to the # bucket and places it last', () => {
    const sections = groupPatientsByLetter([
      p('1', '123 Test'),
      p('2', 'Aziz'),
    ])
    const titles = sections.map((s) => s.title)
    expect(titles).toEqual(['A', '#'])
  })

  it('sorts patients within a section alphabetically', () => {
    const sections = groupPatientsByLetter([
      p('1', 'Anvar Tursunov'),
      p('2', 'Aziz Karimov'),
    ])
    expect(sections[0].data[0].full_name).toBe('Anvar Tursunov')
    expect(sections[0].data[1].full_name).toBe('Aziz Karimov')
  })

  it('handles an empty array gracefully', () => {
    expect(groupPatientsByLetter([])).toEqual([])
  })

  it('folds Uzbek Cyrillic extras (Ў → O, Ғ → G, Қ → Q, Ҳ → H)', () => {
    const sections = groupPatientsByLetter([
      p('1', "Ўткир Aliev"),
      p('2', 'Ғани'),
      p('3', 'Қодир'),
      p('4', 'Ҳасан'),
    ])
    const titles = new Set(sections.map((s) => s.title))
    expect(titles.has('O')).toBe(true)
    expect(titles.has('G')).toBe(true)
    expect(titles.has('Q')).toBe(true)
    expect(titles.has('H')).toBe(true)
  })
})
