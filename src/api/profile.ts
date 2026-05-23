import client from './client'

// Per-resource override. Flip via `EXPO_PUBLIC_MOCK_PROFILE=false`.
const USE_MOCK =
  process.env.EXPO_PUBLIC_MOCK_PROFILE !== 'false' &&
  process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false'

function mockDelay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export interface ApiProfile {
  id: string
  name: string
  email: string
  phone: string | null
  practice_name: string | null
  license_number: string | null
  address: string | null
  working_hours: {
    start: string | null
    end: string | null
  }
  default_appointment_duration: number
}

let MOCK_PROFILE: ApiProfile = {
  id: 'dev-1',
  name: 'Test Doctor',
  email: 'test@identa.uz',
  phone: '+998 90 123 45 67',
  practice_name: 'Identa Clinic',
  license_number: 'L-12345',
  address: 'Toshkent shahar',
  working_hours: { start: '09:00', end: '18:00' },
  default_appointment_duration: 30,
}

export interface UpdateProfilePayload {
  name?: string
  email?: string
  phone?: string | null
  practice_name?: string | null
  license_number?: string | null
  address?: string | null
  working_hours_start?: string
  working_hours_end?: string
  default_appointment_duration?: number
}

export const getProfile = async (): Promise<ApiProfile> => {
  if (USE_MOCK) return mockDelay({ ...MOCK_PROFILE }, 300)
  return client.get<{ data: ApiProfile }>('/settings/profile').then((r) => r.data.data)
}

export const updateProfile = async (payload: UpdateProfilePayload): Promise<ApiProfile> => {
  if (USE_MOCK) {
    MOCK_PROFILE = {
      ...MOCK_PROFILE,
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.email !== undefined ? { email: payload.email } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
      ...(payload.practice_name !== undefined ? { practice_name: payload.practice_name } : {}),
      ...(payload.license_number !== undefined ? { license_number: payload.license_number } : {}),
      ...(payload.address !== undefined ? { address: payload.address } : {}),
      ...(payload.working_hours_start !== undefined || payload.working_hours_end !== undefined
        ? {
            working_hours: {
              start: payload.working_hours_start ?? MOCK_PROFILE.working_hours.start,
              end: payload.working_hours_end ?? MOCK_PROFILE.working_hours.end,
            },
          }
        : {}),
      ...(payload.default_appointment_duration !== undefined
        ? { default_appointment_duration: payload.default_appointment_duration }
        : {}),
    }
    return mockDelay({ ...MOCK_PROFILE }, 500)
  }
  return client
    .put<{ data: ApiProfile }>('/settings/profile', payload)
    .then((r) => r.data.data)
}
