import client from './client'

// HARDCODED MOCK: backend doesn't expose a push-token registration
// endpoint yet (no /devices/register route). Local reminders work fine
// without server registration; remote push will need this endpoint to
// route notifications to the right device. Flip once backend adds
// `POST /devices/register` (or similar) plus a `devices` table.
const USE_MOCK = true

interface RegisterDevicePayload {
  expo_push_token: string
  platform: 'ios' | 'android'
  app_version: string
  device_name?: string
}

interface RegisteredDevice {
  id: string
  expo_push_token: string
  registered_at: string
}

// In-session memory of registered tokens — server would persist in a
// `devices` table tied to the authenticated user. The mock just acks.
const MOCK_REGISTERED: RegisteredDevice[] = []

export async function registerDeviceToken(
  payload: RegisterDevicePayload
): Promise<RegisteredDevice> {
  if (USE_MOCK) {
    // Dedup by token — re-registering same token after relaunch shouldn't
    // produce duplicate entries.
    const existing = MOCK_REGISTERED.find((d) => d.expo_push_token === payload.expo_push_token)
    if (existing) return existing
    const record: RegisteredDevice = {
      id: `dev-${Date.now()}`,
      expo_push_token: payload.expo_push_token,
      registered_at: new Date().toISOString(),
    }
    MOCK_REGISTERED.push(record)
    return new Promise((resolve) => setTimeout(() => resolve(record), 300))
  }
  return client
    .post<{ data: RegisteredDevice }>('/devices/register', payload)
    .then((r) => r.data.data)
}
