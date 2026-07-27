import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import PatientAvatar from '../ui/PatientAvatar'
import { radius, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'
import { useI18n } from '../../i18n'
import type { ApiUser } from '../../types'

interface Props {
  user: ApiUser
}

// Hero card at top of Settings: avatar + name + email + role badge.
export default function ProfileCard({ user }: Props) {
  const { t } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const roleKey =
    user.role === 'dentist' ? 'dentist' :
    user.role === 'assistant' ? 'assistant' :
    'admin'

  return (
    <View style={styles.card}>
      <PatientAvatar name={user.name} uri={user.avatar_url} size={64} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
        <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{t(`settings.role.${roleKey}`)}</Text>
        </View>
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: c.background,
    borderRadius: radius.xxl,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  body: { flex: 1, gap: 3 },
  name: {
    ...typography.title3,
    color: c.brandDeep,
  },
  email: {
    ...typography.subhead,
    color: c.labelSecondary,
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: c.brandLight,
    marginTop: 4,
  },
  roleText: {
    fontFamily: font('700'),
    fontSize: 11,
    fontWeight: '700',
    color: c.brandDeep,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  })
}
