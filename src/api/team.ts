import client from './client'
import type { ApiAssistant, ApiListResponse, ApiResponse } from '../types'

// Per-resource override. Flip via `EXPO_PUBLIC_MOCK_TEAM=false`.
const USE_MOCK =
  process.env.EXPO_PUBLIC_MOCK_TEAM !== 'false' &&
  process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false'

function mockDelay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

let MOCK_TEAM: ApiAssistant[] = [
  {
    id: 'as-1',
    name: 'Madina Karimova',
    email: 'madina@identa.uz',
    phone: '+998 90 111 22 33',
    account_status: 'active',
    assistant_permissions: ['patients.view', 'patients.manage', 'appointments.view', 'appointments.manage'],
    last_login_at: new Date(Date.now() - 2 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 60 * 86400_000).toISOString(),
  },
  {
    id: 'as-2',
    name: 'Sardor Yusupov',
    email: 'sardor@identa.uz',
    phone: '+998 91 222 33 44',
    account_status: 'active',
    assistant_permissions: ['patients.view', 'appointments.view', 'payments.view'],
    last_login_at: new Date(Date.now() - 7 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 30 * 86400_000).toISOString(),
  },
]

export interface AssistantPayload {
  name: string
  email: string
  phone?: string
  password?: string
  permissions: string[]
}

export const listAssistants = async (): Promise<ApiListResponse<ApiAssistant>> => {
  if (USE_MOCK) {
    return mockDelay({
      data: MOCK_TEAM.filter((a) => a.account_status !== 'deleted'),
      meta: {
        pagination: {
          current_page: 1,
          last_page: 1,
          per_page: 50,
          total: MOCK_TEAM.filter((a) => a.account_status !== 'deleted').length,
        },
      },
    })
  }
  return client.get<ApiListResponse<ApiAssistant>>('/team/assistants').then((r) => r.data)
}

export const createAssistant = async (payload: AssistantPayload): Promise<ApiAssistant> => {
  if (USE_MOCK) {
    if (!payload.name.trim() || !payload.email.trim()) throw new Error('Missing fields')
    if ((payload.password?.length ?? 0) < 8) throw new Error('Password too short')
    const newOne: ApiAssistant = {
      id: `as-${Date.now()}`,
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: payload.phone?.trim() || null,
      account_status: 'active',
      assistant_permissions: payload.permissions,
      created_at: new Date().toISOString(),
    }
    MOCK_TEAM = [...MOCK_TEAM, newOne]
    return mockDelay(newOne, 500)
  }
  // Backend StoreAssistantRequest requires `password` to be `confirmed`, so
  // it needs a matching `password_confirmation`. The mobile form has a single
  // password field, so mirror it here.
  return client
    .post<ApiResponse<ApiAssistant>>('/team/assistants', {
      ...payload,
      password_confirmation: payload.password,
    })
    .then((r) => r.data.data)
}

export const updateAssistant = async (id: string, payload: AssistantPayload): Promise<ApiAssistant> => {
  if (USE_MOCK) {
    MOCK_TEAM = MOCK_TEAM.map((a) =>
      a.id === id
        ? {
            ...a,
            name: payload.name.trim(),
            email: payload.email.trim(),
            phone: payload.phone?.trim() || null,
            assistant_permissions: payload.permissions,
          }
        : a
    )
    const updated = MOCK_TEAM.find((a) => a.id === id)
    if (!updated) throw new Error('Not found')
    return mockDelay(updated, 500)
  }
  return client.put<ApiResponse<ApiAssistant>>(`/team/assistants/${id}`, payload).then((r) => r.data.data)
}

export const updateAssistantStatus = async (
  id: string,
  status: 'active' | 'blocked'
): Promise<ApiAssistant> => {
  if (USE_MOCK) {
    MOCK_TEAM = MOCK_TEAM.map((a) => (a.id === id ? { ...a, account_status: status } : a))
    const updated = MOCK_TEAM.find((a) => a.id === id)
    if (!updated) throw new Error('Not found')
    return mockDelay(updated, 400)
  }
  return client
    .patch<ApiResponse<ApiAssistant>>(`/team/assistants/${id}/status`, { status })
    .then((r) => r.data.data)
}

// Reset an assistant's password — backend `POST /team/assistants/{id}/reset-password`
// requires `new_password` + matching `new_password_confirmation` (min 8).
export const resetAssistantPassword = async (
  id: string,
  newPassword: string
): Promise<void> => {
  if (USE_MOCK) {
    if (newPassword.length < 8) throw new Error('Password too short')
    return mockDelay(undefined, 500)
  }
  await client.post(`/team/assistants/${id}/reset-password`, {
    new_password: newPassword,
    new_password_confirmation: newPassword,
  })
}

export const deleteAssistant = async (id: string): Promise<void> => {
  if (USE_MOCK) {
    MOCK_TEAM = MOCK_TEAM.map((a) =>
      a.id === id ? { ...a, account_status: 'deleted' } : a
    )
    return mockDelay(undefined, 400)
  }
  return client.delete(`/team/assistants/${id}`).then(() => undefined)
}
