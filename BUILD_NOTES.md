# Build & ops notes

Short reference for re-enabling features we deliberately disabled in v1, plus
the EAS commands used most often.

## Sentry source-map upload (disabled)

The `@sentry/react-native/expo` config plugin was removed from `app.json`
because it required real Sentry org/project slugs (we had placeholder values
that would have silently broken EAS builds during source-map upload).
Runtime crash reporting still works whenever `EXPO_PUBLIC_SENTRY_DSN` is
set — the plugin is only needed for symbolicated stack traces in production.

To re-enable once a Sentry project is provisioned:

1. Add to `app.json` `plugins` array:
   ```json
   ["@sentry/react-native/expo", {
     "organization": "<your-sentry-org-slug>",
     "project": "identa-mobile",
     "url": "https://sentry.io/"
   }]
   ```
2. Add `SENTRY_AUTH_TOKEN` as an EAS secret (`eas secret:create`).
3. Set `EXPO_PUBLIC_SENTRY_DSN` in EAS build env (already declared in
   `eas.json` for all profiles).

## EAS build commands

```bash
# Initial setup (one-time)
eas login
eas init             # links the project to an EAS project ID
eas update:configure # only if OTA updates wanted

# Android preview APK (internal distribution, sharable link)
eas build --profile preview --platform android

# Android production AAB (Play Store upload)
eas build --profile production --platform android

# iOS preview (Ad-hoc) and production (App Store)
eas build --profile preview --platform ios
eas build --profile production --platform ios

# Submit to stores (requires submit creds in eas.json)
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

## Maestro E2E tests

Run on a connected device or running emulator:

```bash
# All tests
npm run test:e2e

# Tag-filtered subsets
npm run test:e2e:smoke
npm run test:e2e:auth
npm run test:e2e:nav
npm run test:e2e:odontogram
npm run test:e2e:treatment
```

Tests need a backend account; set credentials via env:

```bash
MAESTRO_TEST_EMAIL=dentist@identa.test \
MAESTRO_TEST_PASSWORD=password123 \
  npm run test:e2e:smoke
```

## Force-mocked API slices

These slices are hard-coded to mock data (backend endpoints missing). Flip
when the backend ships:

- `src/api/sessions.ts` — `USE_MOCK = true` (backend missing `/sessions/activity`)
- `src/api/notifications.ts` — `USE_MOCK = true` (backend missing `/settings/notifications`)

## Mobile↔Web feature parity gaps (deferred to v1.1)

- Payment edit form (only delete shipped in v1)
- Payments history filter (date / method / patient)
- Invoice list view (`/invoices`)
- Image direct-S3 upload (mobile uses multipart fallback — functionally equivalent)
- Inline odontogram on PatientDetail (mobile only has the dedicated screen)
