import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type ImageProps,
  type ImageStyle,
  type StyleProp,
} from 'react-native'

import { API_URL } from '../../constants'
import {
  loadProtectedPatientPhoto,
  normalizeProtectedPatientMediaUri,
} from '../../lib/protectedPatientPhoto'
import { useAuthStore } from '../../stores/auth'
import Icon from './Icon'

interface Props {
  uri: string
  style: StyleProp<ImageStyle>
  resizeMode?: ImageProps['resizeMode']
}

/**
 * Displays patient-owned media without leaking bearer tokens to arbitrary
 * hosts. Same-origin API media is downloaded into the session-scoped cache;
 * signed CDN and local file URLs continue through React Native Image.
 */
export default function ProtectedPatientMediaImage({
  uri,
  style,
  resizeMode = 'cover',
}: Props) {
  const accessToken = useAuthStore((state) => state.tokens?.access_token)
  const userId = useAuthStore((state) => state.user?.id)
  const normalizedUri = normalizeProtectedPatientMediaUri(uri)
  const isProtected =
    normalizedUri === API_URL ||
    normalizedUri.startsWith(`${API_URL}/`) ||
    normalizedUri.startsWith(`${API_URL}?`)
  const [local, setLocal] = useState<{ remote: string; uri: string } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (!isProtected || !accessToken || !userId) return

    let mounted = true
    loadProtectedPatientPhoto(normalizedUri, accessToken, userId)
      .then((localUri) => {
        if (mounted) setLocal({ remote: normalizedUri, uri: localUri })
      })
      .catch(() => {
        if (mounted) setFailed(true)
      })

    return () => {
      mounted = false
    }
  }, [accessToken, isProtected, normalizedUri, userId])

  const displayUri = isProtected
    ? local?.remote === normalizedUri
      ? local.uri
      : null
    : normalizedUri

  if (failed) {
    return (
      <View style={[style, styles.state]}>
        <Icon name="image-outline" size={20} color="#8A94A6" />
      </View>
    )
  }

  if (!displayUri) {
    return (
      <View style={[style, styles.state]}>
        <ActivityIndicator size="small" color="#14B8A6" />
      </View>
    )
  }

  return (
    <Image
      source={{ uri: displayUri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
    />
  )
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
