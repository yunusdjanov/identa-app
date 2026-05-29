import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import InputCard from '../ui/InputCard'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import EmptyState from '../ui/EmptyState'
import { useToast } from '../ui/Toast'

import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../api/patients'
import { useI18n } from '../../i18n'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { isOfflineError } from '../../lib/offlineGuard'
import { useAuthStore } from '../../stores/auth'
import { canManage } from '../../lib/permissions'
import type { ApiPatientCategory } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
}

const COLOR_PALETTE = [
  '#3B82F6', // blue
  '#A855F7', // purple
  '#10B981', // green
  '#EF4444', // red
  '#F59E0B', // amber
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#6366F1', // indigo
]

export default function PatientCategoriesSheet({ visible, onClose }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const toast = useToast()
  const queryClient = useQueryClient()

  const categoriesQuery = useQuery({
    queryKey: ['patient-categories', 'list'],
    queryFn: listCategories,
    enabled: visible,
    staleTime: 30_000,
  })

  const categories = categoriesQuery.data ?? []

  // Category writes are gated by `patients.manage` on the backend. View-only
  // assistants and read_only subscriptions get a read-only list.
  const user = useAuthStore((s) => s.user)
  const canManageCats = canManage(user, 'patients')

  // Form state for create/edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(COLOR_PALETTE[0]!)

  const openCreate = () => {
    setEditingId(null)
    setName('')
    setColor(COLOR_PALETTE[0]!)
    setShowForm(true)
  }

  const openEdit = (cat: ApiPatientCategory) => {
    Haptics.selectionAsync()
    setEditingId(cat.id)
    setName(cat.name)
    setColor(cat.color)
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setName('')
  }

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['patient-categories'] })
    queryClient.invalidateQueries({ queryKey: ['patients'] })
  }

  const createMutation = useMutation({
    mutationFn: () => createCategory(name, color),
    onSuccess: () => {
      toast.success(t('patients.categories.created'))
      refetch()
      cancelForm()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('patients.categories.failed'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => updateCategory(editingId!, name, color),
    onSuccess: () => {
      toast.success(t('patients.categories.updated'))
      refetch()
      cancelForm()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('patients.categories.failed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      toast.success(t('patients.categories.deleted'))
      refetch()
    },
    onError: (err) => {
      if (isOfflineError(err)) return
      toast.error(t('patients.categories.failed'))
    },
  })

  const onDelete = (cat: ApiPatientCategory) => {
    Alert.alert(t('patients.categories.deleteConfirm'), t('patients.categories.deleteConfirmSub'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          deleteMutation.mutate(cat.id)
        },
      },
    ])
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    if (editingId) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('patients.categories.title')}>
      {/* Form when active */}
      {showForm ? (
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>{t('patients.categories.nameLabel')}</Text>
          <InputCard
            iconName="pricetag-outline"
            value={name}
            onChangeText={setName}
            placeholder={t('patients.categories.namePlaceholder')}
            autoCapitalize="words"
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>
            {t('patients.categories.colorLabel')}
          </Text>
          <View style={styles.colorRow}>
            {COLOR_PALETTE.map((hex) => {
              const active = hex === color
              return (
                <Pressable
                  key={hex}
                  onPress={() => {
                    Haptics.selectionAsync()
                    setColor(hex)
                  }}
                  style={[styles.colorSwatch, { backgroundColor: hex }, active && styles.colorSwatchActive]}
                >
                  {active ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : null}
                </Pressable>
              )
            })}
          </View>

          <View style={styles.formActions}>
            <Button
              title={t('common.cancel')}
              variant="secondary"
              size="md"
              fullWidth
              onPress={cancelForm}
              style={{ flex: 1 }}
            />
            <Button
              title={editingId ? t('patients.categories.update') : t('patients.categories.save')}
              size="md"
              fullWidth
              loading={isPending}
              disabled={!name.trim()}
              onPress={handleSubmit}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : canManageCats ? (
        <Button
          title={t('patients.categories.addNew')}
          variant="tinted"
          size="lg"
          fullWidth
          leftIcon={<Icon name="add" size={18} color={c.brandDeep as string} />}
          onPress={openCreate}
        />
      ) : null}

      {/* List */}
      {categories.length === 0 && !showForm ? (
        <EmptyState
          iconName="pricetags-outline"
          title={t('patients.categories.empty')}
          subtitle={t('patients.categories.emptySub')}
        />
      ) : (
        <View style={styles.list}>
          {categories.map((cat, idx) => (
            <React.Fragment key={cat.id}>
              <View style={styles.row}>
                <View style={[styles.swatch, { backgroundColor: cat.color }]} />
                <Text style={styles.name} numberOfLines={1}>
                  {cat.name}
                </Text>
                {canManageCats ? (
                  <>
                    <Pressable
                      onPress={() => openEdit(cat)}
                      hitSlop={8}
                      style={styles.actionBtn}
                    >
                      <Icon name="create-outline" size={18} color={c.brand as string} />
                    </Pressable>
                    <Pressable
                      onPress={() => onDelete(cat)}
                      hitSlop={8}
                      style={styles.actionBtn}
                    >
                      <Icon name="trash-outline" size={18} color={c.danger as string} />
                    </Pressable>
                  </>
                ) : null}
              </View>
              {idx < categories.length - 1 ? <View style={styles.separator} /> : null}
            </React.Fragment>
          ))}
        </View>
      )}
    </BottomSheet>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    formCard: {
      backgroundColor: c.brandLight,
      borderRadius: radius.xl,
      padding: 14,
      gap: 6,
    },
    fieldLabel: {
      fontFamily: font('700'),
      fontSize: 11,
      fontWeight: '700',
      color: c.labelSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginLeft: 4,
    },
    colorRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    colorSwatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchActive: {
      borderWidth: 3,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    formActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    list: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
    },
    swatch: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    name: {
      flex: 1,
      ...typography.bodyEmphasized,
      color: c.label,
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fillQuaternary,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 44,
    },
  })
}
