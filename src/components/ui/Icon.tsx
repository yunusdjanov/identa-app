import React from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'

// Centralised icon component. Lets us swap icon libraries app-wide later
// without touching call sites. Built on Ionicons (outline variant by default)
// which matches iOS native iconography.
// We import the Ionicons font subpackage directly so Metro doesn't have to
// resolve every icon set in @expo/vector-icons.

export type IconName = keyof typeof Ionicons.glyphMap

interface Props {
  name: IconName
  size?: number
  color?: string
}

export default function Icon({ name, size = 22, color = '#000' }: Props) {
  return <Ionicons name={name} size={size} color={color} />
}
