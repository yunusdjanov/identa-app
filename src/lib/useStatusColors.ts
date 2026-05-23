import { useMemo } from 'react'
import { useColors } from './useColors'
import type { ApiAppointment } from '../types'

type Status = ApiAppointment['status']

export interface StatusColorBundle {
  // Solid fill — for buttons, badges, status pills.
  bg: string
  // Translucent tint — for soft backgrounds like row highlights or chips.
  tint: string
  // Foreground tone — text/icon over tinted surfaces.
  fg: string
}

// Theme-aware status color palette. Centralizes the
// appointment-status visual language so screens / cards / sheets share the
// same mapping. Replaces hand-rolled #16A34A / #DC2626 hex literals.
export function useStatusColors(): Record<Status, StatusColorBundle> {
  const c = useColors()
  return useMemo(
    () => ({
      scheduled: {
        bg: c.scheduled,
        tint: 'rgba(10, 132, 255, 0.14)',
        fg: c.scheduled,
      },
      completed: {
        bg: c.completed,
        tint: 'rgba(48, 209, 88, 0.14)',
        fg: c.completed,
      },
      cancelled: {
        bg: c.cancelled,
        tint: 'rgba(142, 142, 147, 0.16)',
        fg: c.cancelled,
      },
      no_show: {
        bg: c.no_show,
        tint: 'rgba(255, 69, 58, 0.14)',
        fg: c.no_show,
      },
    }),
    [c]
  )
}
