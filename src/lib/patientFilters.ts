const SYSTEM_FILTER_IDS = new Set(['all', 'archived', 'inactive', 'inactive_1y'])

export function isPatientCategoryFilter(filterId: string): boolean {
  return !SYSTEM_FILTER_IDS.has(filterId)
}

export function getPatientInactiveBefore(
  filterId: string,
  now = new Date()
): string | undefined {
  const months = filterId === 'inactive' ? 6 : filterId === 'inactive_1y' ? 12 : null
  if (months == null) return undefined

  // Clamp month-end dates (for example, Aug 31 -> Feb 28) instead of
  // allowing Date#setMonth to roll the cutoff into the following month.
  const targetMonthIndex = now.getMonth() - months
  const lastTargetDay = new Date(
    now.getFullYear(),
    targetMonthIndex + 1,
    0
  ).getDate()
  const cutoff = new Date(
    now.getFullYear(),
    targetMonthIndex,
    Math.min(now.getDate(), lastTargetDay)
  )

  const year = cutoff.getFullYear()
  const month = String(cutoff.getMonth() + 1).padStart(2, '0')
  const day = String(cutoff.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
