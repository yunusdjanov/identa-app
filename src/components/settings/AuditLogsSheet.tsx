import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TextInput, Pressable } from 'react-native'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import BottomSheet from '../ui/BottomSheet'
import Icon from '../ui/Icon'
import EmptyState from '../ui/EmptyState'
import Button from '../ui/Button'
import { useI18n } from '../../i18n'
import type { TFunction } from '../../i18n/helpers'
import { listAuditLogs } from '../../api/audit'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { toIntlLocale } from '../../lib/format'
import type { Locale } from '../../constants'
import {
  font,
  inputMetrics,
  radius,
  spacing,
  typography,
} from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import type { ApiAuditLogEntry } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatDateTime(value: string | null, locale: Locale): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function prettifyEvent(eventType: string): string {
  const s = eventType.replace(/[._]/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : eventType
}

function eventLabel(eventType: string, t: TFunction): string {
  const key = `settings.logs.event.${eventType}`
  const translated = t(key)
  return translated === key ? prettifyEvent(eventType) : translated
}

function maskRoute(raw: string): string {
  const norm = raw.replace(/^\/+/, '').split('?')[0] ?? ''
  const segs = norm
    .split('/')
    .map((x) => (UUID_RE.test(x) ? '{id}' : x))
    .filter(Boolean)
  return segs.length ? '/' + segs.join('/') : '—'
}

function formatEntity(entry: ApiAuditLogEntry): string {
  const type = (entry.entity_type ?? '').trim()
  const id = (entry.entity_id ?? '').trim()
  if (!type) return id || '—'
  if (type === 'route') return maskRoute(id)
  return `${type} / ${id || '—'}`
}

function maskIp(ip: string | null, t: TFunction): string {
  if (!ip) return '—'
  if (ip === '127.0.0.1' || ip === '::1') return t('settings.logs.localhost')
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/)
  if (m) return `${m[1]}.${m[2]}.${m[3]}.xxx`
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean)
    return parts.slice(0, 2).join(':') + ':xxxx'
  }
  return ip
}

function requiredPermission(meta: ApiAuditLogEntry['metadata']): string | null {
  if (!meta || typeof meta !== 'object') return null
  const v = (meta as Record<string, unknown>).required_permission
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function roleLabel(role: string | null | undefined, t: TFunction): string {
  if (!role) return ''
  const key = `settings.role.${role}`
  const label = t(key)
  return label === key ? role : label
}

export default function AuditLogsSheet({ visible, onClose }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search, 300)
  const trimmedSearch = debouncedSearch.trim()
  const querySearch = trimmedSearch.length >= 2 ? trimmedSearch.slice(0, 100) : undefined

  const query = useQuery({
    queryKey: ['audit-logs', querySearch, page],
    queryFn: () =>
      listAuditLogs({ page, per_page: 10, search: querySearch }),
    enabled: visible,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  const entries = query.data?.data ?? []
  const totalPages = query.data?.meta?.pagination?.total_pages ?? 1
  const canPrev = page > 1
  const canNext = page < totalPages
  const paging = query.isFetching && query.isPlaceholderData

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('settings.logs.title')}
      closeAccessibilityLabel={t('common.close')}
    >
      <Text style={styles.subtitle}>{t('settings.logs.subtitle')}</Text>

      <View style={styles.searchWrap}>
        <Icon name="search-outline" size={16} color={c.labelTertiary as string} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder={t('settings.logs.searchPlaceholder')}
          accessibilityLabel={t('settings.logs.searchPlaceholder')}
          placeholderTextColor={c.labelTertiary as string}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.clear')}
            hitSlop={8}
            onPress={() => {
              setSearch('')
              setPage(1)
            }}
            style={styles.clearButton}
          >
            <Icon name="close-circle" size={17} color={c.labelTertiary as string} />
          </Pressable>
        ) : null}
      </View>

      {query.isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={c.brand as string} />
        </View>
      ) : query.isError ? (
        <EmptyState
          iconName="cloud-offline-outline"
          title={t('settings.logs.loadFailed')}
          tone="danger"
          action={
            <Button
              title={t('common.retry')}
              variant="secondary"
              size="md"
              onPress={() => query.refetch()}
            />
          }
        />
      ) : entries.length === 0 ? (
        <EmptyState
          iconName="document-text-outline"
          title={t('settings.logs.empty')}
          tone="neutral"
        />
      ) : (
        <View style={styles.list}>
          {entries.map((e, idx) => {
            const perm = requiredPermission(e.metadata)
            const role = roleLabel(e.actor?.role, t)
            return (
              <React.Fragment key={e.id}>
                <View style={styles.row}>
                  <View style={styles.rowHead}>
                    <Text style={styles.event} numberOfLines={1}>
                      {eventLabel(e.event_type, t)}
                    </Text>
                    <Text style={styles.time}>{formatDateTime(e.created_at, locale as Locale)}</Text>
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {t('settings.logs.actor')}: {e.actor?.name || '—'}
                    {role ? ` (${role})` : ''}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {t('settings.logs.entity')}: {formatEntity(e)}
                  </Text>
                  {perm ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {t('settings.logs.requiredPermission')}: {perm}
                    </Text>
                  ) : null}
                  <Text style={styles.metaSubtle} numberOfLines={1}>
                    {t('settings.logs.ip')}: {maskIp(e.ip_address, t)}
                  </Text>
                </View>
                {idx < entries.length - 1 ? <View style={styles.separator} /> : null}
              </React.Fragment>
            )
          })}
        </View>
      )}

      {!query.isLoading && !query.isError && entries.length > 0 ? (
        <View style={styles.pager}>
          <Pressable
            disabled={!canPrev || paging}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={[styles.pageBtn, (!canPrev || paging) && styles.pageBtnDisabled]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            accessibilityState={{ disabled: !canPrev || paging }}
          >
            <Icon name="chevron-back" size={18} color={(canPrev ? c.label : c.labelTertiary) as string} />
          </Pressable>
          <Text style={styles.pageText}>
            {t('settings.logs.pageOf', { page, total: totalPages })}
          </Text>
          <Pressable
            disabled={!canNext || paging}
            onPress={() => setPage((p) => p + 1)}
            style={[styles.pageBtn, (!canNext || paging) && styles.pageBtnDisabled]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.next')}
            accessibilityState={{ disabled: !canNext || paging }}
          >
            <Icon name="chevron-forward" size={18} color={(canNext ? c.label : c.labelTertiary) as string} />
          </Pressable>
        </View>
      ) : null}
    </BottomSheet>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    subtitle: {
      ...typography.subhead,
      color: c.labelSecondary,
      marginTop: -spacing.xs,
      marginBottom: spacing.sm,
      paddingHorizontal: 4,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      height: inputMetrics.height,
      borderRadius: radius.lg,
      backgroundColor: c.fillQuaternary,
      marginBottom: spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontFamily: font('400'),
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
      color: c.label,
      padding: 0,
    },
    clearButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    loader: { paddingVertical: spacing.xl, alignItems: 'center' },
    list: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    row: { paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    event: { flex: 1, ...typography.bodyEmphasized, color: c.label },
    time: { ...typography.caption1, color: c.labelTertiary },
    meta: { ...typography.footnote, color: c.labelSecondary },
    metaSubtle: { ...typography.caption1, color: c.labelTertiary, marginTop: 2 },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginHorizontal: 14,
    },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingTop: spacing.md,
    },
    pageBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fillQuaternary,
    },
    pageBtnDisabled: { opacity: 0.4 },
    pageText: {
      ...typography.subhead,
      color: c.labelSecondary,
      minWidth: 64,
      textAlign: 'center',
    },
  })
}
