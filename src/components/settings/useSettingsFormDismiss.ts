import { useCallback } from 'react'

import { useDialog } from '../ui/Dialog'
import { useI18n } from '../../i18n'

interface Options {
  isDirty: boolean
  isPending: boolean
}

/**
 * Keeps editable Settings sheets open while a save is in flight and asks
 * before discarding local changes. BottomSheet invokes this before animating
 * away, so declining the prompt never leaves an invisible-but-mounted sheet.
 */
export function useSettingsFormDismiss({ isDirty, isPending }: Options) {
  const { confirm } = useDialog()
  const { t } = useI18n()

  return useCallback(async (): Promise<boolean> => {
    if (isPending) return false
    if (!isDirty) return true

    return confirm({
      title: t('settings.unsaved.title'),
      message: t('settings.unsaved.message'),
      confirmLabel: t('settings.unsaved.discard'),
      destructive: true,
    })
  }, [confirm, isDirty, isPending, t])
}
