// Sentry's helper wraps Expo's default Metro config so:
//   • `@sentry/browser` and the rest of the @sentry/* family resolve
//     correctly from the React Native bundle
//   • source-map debug ids get injected so EAS Build's source-map upload
//     lines up symbolicated stacks with the bundle in production
//
// Falling back to plain expo/metro-config means production stack traces
// will be minified gibberish in the Sentry UI, so keep this wrapper.
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const config = getSentryExpoConfig(__dirname)

module.exports = config
