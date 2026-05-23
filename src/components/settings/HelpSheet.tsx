import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Linking, Animated, Easing } from 'react-native'
import * as Haptics from 'expo-haptics'

import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { useI18n } from '../../i18n'
import { getTranslationArray } from '../../i18n/helpers'
import type { Locale } from '../../constants'
import { radius, spacing, typography, font } from '../../constants/theme'
import { useColors, type Colors } from '../../lib/useColors'

interface Props {
  visible: boolean
  onClose: () => void
}

const SUPPORT_EMAIL = 'support@identa.uz'

export default function HelpSheet({ visible, onClose }: Props) {
  const { t, locale } = useI18n()
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const faq = useMemo(
    () =>
      getTranslationArray<{ q: string; a: string }>(
        locale as Locale,
        'settings.helpSheet.faq'
      ),
    [locale]
  )

  const toggle = (idx: number) => {
    Haptics.selectionAsync()
    setOpenIdx((prev) => (prev === idx ? null : idx))
  }

  const onContact = () => {
    Haptics.selectionAsync()
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Identa%20Support`).catch(() => {})
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.helpSheet.title')}>
      <Text style={styles.subtitle}>{t('settings.helpSheet.subtitle')}</Text>

      <View style={styles.list}>
        {faq.map((item, idx) => (
          <React.Fragment key={idx}>
            <FaqItem
              question={item.q}
              answer={item.a}
              open={openIdx === idx}
              onPress={() => toggle(idx)}
            />
            {idx < faq.length - 1 ? <View style={styles.separator} /> : null}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.contactCard}>
        <View style={styles.contactIcon}>
          <Icon name="chatbubbles-outline" size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.contactTitle}>{t('settings.helpSheet.contactTitle')}</Text>
        <Text style={styles.contactDesc}>{t('settings.helpSheet.contactDesc')}</Text>
        <Button
          title={t('settings.helpSheet.contactButton')}
          variant="primary"
          size="md"
          fullWidth
          leftIcon={<Icon name="mail-outline" size={18} color="#FFFFFF" />}
          onPress={onContact}
        />
      </View>
    </BottomSheet>
  )
}

function FaqItem({
  question,
  answer,
  open,
  onPress,
}: {
  question: string
  answer: string
  open: boolean
  onPress: () => void
}) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const rotate = React.useRef(new Animated.Value(open ? 1 : 0)).current

  React.useEffect(() => {
    Animated.timing(rotate, {
      toValue: open ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [open, rotate])

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  })

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        hitSlop={4}
      >
        <Text style={styles.question} numberOfLines={2}>
          {question}
        </Text>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Icon name="chevron-down" size={18} color={c.labelSecondary as string} />
        </Animated.View>
      </Pressable>
      {open ? (
        <View style={styles.answerWrap}>
          <Text style={styles.answer}>{answer}</Text>
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    subtitle: {
      ...typography.subhead,
      color: c.labelSecondary,
      marginTop: -spacing.xs,
      marginBottom: spacing.xs,
      paddingHorizontal: 4,
    },
    list: {
      backgroundColor: c.background,
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    rowPressed: { backgroundColor: c.fillQuaternary },
    question: {
      ...typography.bodyEmphasized,
      color: c.label,
      flex: 1,
    },
    answerWrap: {
      paddingHorizontal: 16,
      paddingBottom: 14,
      paddingTop: 0,
    },
    answer: {
      ...typography.subhead,
      color: c.labelSecondary,
      lineHeight: 20,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator as string,
      marginLeft: 16,
    },
    contactCard: {
      backgroundColor: c.brandLight,
      borderRadius: radius.xl,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.xs,
    },
    contactIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    contactTitle: {
      fontFamily: font('700'),
      fontSize: 17,
      fontWeight: '700',
      color: c.brandDeep,
      textAlign: 'center',
    },
    contactDesc: {
      ...typography.subhead,
      color: c.labelSecondary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
  })
}
