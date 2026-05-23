import type { ApiAppointment } from '../types'

// Returns a Set of appointment IDs that have a time overlap with another
// active (non-cancelled, non-no_show) appointment in the same list.
// Same-status pairs are detected; cancelled/no_show are excluded from blocking.
export function findConflictingIds(appointments: ApiAppointment[]): Set<string> {
  const conflicts = new Set<string>()
  const active = appointments.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'no_show'
  )

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!
      const b = active[j]!
      const aStart = toMin(a.start_time)
      const aEnd = toMin(a.end_time)
      const bStart = toMin(b.start_time)
      const bEnd = toMin(b.end_time)
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.add(a.id)
        conflicts.add(b.id)
      }
    }
  }

  return conflicts
}

function toMin(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10) || 0)
  return h * 60 + m
}
