export const FLOATING_TAB_BAR_MIN_HEIGHT = 64
export const FLOATING_TAB_BAR_MIN_BOTTOM_INSET = 16
export const FLOATING_TAB_BAR_CONTENT_GAP = 12

export function getFloatingTabBarContentInset(bottomInset: number): number {
  return (
    Math.max(bottomInset, FLOATING_TAB_BAR_MIN_BOTTOM_INSET) +
    FLOATING_TAB_BAR_MIN_HEIGHT +
    FLOATING_TAB_BAR_CONTENT_GAP
  )
}
