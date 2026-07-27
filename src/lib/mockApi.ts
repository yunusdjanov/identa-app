/**
 * Mock API data is always opt-in. A slice-level flag can explicitly override
 * the master flag, while an absent configuration safely uses the real API.
 */
export function shouldUseMockApi(
  resourceFlag: string | undefined,
  masterFlag: string | undefined
): boolean {
  return resourceFlag === 'true' || (resourceFlag !== 'false' && masterFlag === 'true')
}
