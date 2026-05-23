import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { font } from '../../constants/theme'

interface Props {
  title: string
}

// iOS Contacts-style section header: subtle gray bar with a small bold letter.
// Sticky on scroll thanks to SectionList's stickySectionHeadersEnabled.
export default function SectionHeader({ title }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60, 60, 67, 0.18)',
  },
  text: {
    fontFamily: font('700'),
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.7)',
    letterSpacing: 0.3,
  },
})
