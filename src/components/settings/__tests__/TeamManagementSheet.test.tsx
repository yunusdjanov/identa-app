import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { I18nProvider } from '../../../i18n'
import {
  deleteAssistant,
  listAssistants,
  resetAssistantPassword,
  updateAssistantStatus,
} from '../../../api/team'
import { useAuthStore } from '../../../stores/auth'
import type { ApiAssistant, ApiUser } from '../../../types'
import TeamManagementSheet from '../TeamManagementSheet'

const mockConfirm = jest.fn()

jest.mock('../../ui/BottomSheet', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const { View } = require('react-native')
    return visible ? <View>{children}</View> : null
  },
}))

jest.mock('../../../api/team', () => ({
  listAssistants: jest.fn(),
  createAssistant: jest.fn(),
  updateAssistant: jest.fn(),
  updateAssistantStatus: jest.fn(),
  resetAssistantPassword: jest.fn(),
  deleteAssistant: jest.fn(),
}))

jest.mock('../../ui/Toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}))

jest.mock('../../ui/Dialog', () => ({
  useDialog: () => ({ confirm: mockConfirm }),
}))

const active: ApiAssistant = {
  id: 'active-1',
  name: 'Madina Karimova',
  email: 'madina@example.com',
  account_status: 'active',
  assistant_permissions: ['patients.view'],
}

const blocked: ApiAssistant = {
  id: 'blocked-1',
  name: 'Sardor Yusupov',
  email: 'sardor@example.com',
  account_status: 'blocked',
  assistant_permissions: ['appointments.view'],
}

const deleted: ApiAssistant = {
  id: 'deleted-1',
  name: 'Deleted Member',
  email: 'deleted@deleted.invalid',
  account_status: 'deleted',
  assistant_permissions: [],
}

function dentist(readOnly = false): ApiUser {
  return {
    id: 'dentist-1',
    name: 'Dentist',
    email: 'dentist@example.com',
    role: 'dentist',
    account_status: 'active',
    subscription: {
      is_configured: true,
      plan: 'pro',
      status: readOnly ? 'read_only' : 'active',
      access_mode: readOnly ? 'read_only' : 'full',
      days_remaining: 10,
      staff_limit: 5,
      active_staff_count: 1,
      is_read_only: readOnly,
    },
  }
}

function page(data: ApiAssistant[], current = 1, totalPages = 1) {
  return {
    data,
    meta: {
      pagination: {
        page: current,
        total_pages: totalPages,
        per_page: 20,
        total: data.length,
      },
    },
  }
}

function renderSheet() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale="uz">
        <TeamManagementSheet visible onClose={jest.fn()} />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('TeamManagementSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ user: dentist(), isAuthenticated: true } as never)
    jest.mocked(listAssistants).mockResolvedValue(page([active, blocked]))
    jest.mocked(updateAssistantStatus).mockResolvedValue({ ...active, account_status: 'blocked' })
    jest.mocked(resetAssistantPassword).mockResolvedValue(undefined)
    jest.mocked(deleteAssistant).mockResolvedValue(undefined)
  })

  it('filters deleted records and loads the next page', async () => {
    jest.mocked(listAssistants).mockImplementation(async (currentPage) => (
      currentPage === 1
        ? page([active, deleted], 1, 2)
        : page([blocked], 2, 2)
    ))
    const screen = renderSheet()

    expect(await screen.findByText('Madina Karimova')).toBeTruthy()
    expect(screen.queryByText('Deleted Member')).toBeNull()
    expect(listAssistants).toHaveBeenCalledWith(1, 20)

    fireEvent.press(screen.getByLabelText("Ko'proq yuklash"))

    expect(await screen.findByText('Sardor Yusupov')).toBeTruthy()
    expect(listAssistants).toHaveBeenCalledWith(2, 20)
  })

  it('shows a retry state instead of a false empty state on query failure', async () => {
    jest.mocked(listAssistants).mockRejectedValue(new Error('network'))
    const screen = renderSheet()

    expect(await screen.findByText("Xodimlarni yuklab bo'lmadi")).toBeTruthy()
    expect(screen.queryByText("Hali xodim yo'q")).toBeNull()
    expect(screen.getByLabelText('Qayta urinish')).toBeTruthy()
  })

  it('asks for confirmation before blocking access', async () => {
    mockConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const screen = renderSheet()
    const blockButton = await screen.findByLabelText('Bloklash')

    fireEvent.press(blockButton)
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      destructive: true,
      confirmLabel: 'Bloklash',
    })))
    expect(updateAssistantStatus).not.toHaveBeenCalled()

    fireEvent.press(blockButton)
    await waitFor(() => expect(updateAssistantStatus).toHaveBeenCalledWith('active-1', 'blocked'))
    await waitFor(() => expect(listAssistants).toHaveBeenCalledTimes(2))
  })

  it('disables every team mutation in read-only mode to match the backend contract', async () => {
    useAuthStore.setState({ user: dentist(true), isAuthenticated: true } as never)
    const screen = renderSheet()

    expect((await screen.findByLabelText('Yangi xodim')).props.accessibilityState.disabled).toBe(true)
    expect(await screen.findByText('Madina Karimova')).toBeTruthy()
    expect(screen.getAllByLabelText('Xodimni tahrirlash').every(
      (button) => button.props.accessibilityState.disabled === true
    )).toBe(true)
    expect(screen.getAllByLabelText('Parolni tiklash').every(
      (button) => button.props.accessibilityState.disabled === true
    )).toBe(true)
    expect(screen.getByLabelText('Bloklash').props.accessibilityState.disabled).toBe(true)
    expect(screen.getByLabelText('Blokdan chiqarish').props.accessibilityState.disabled).toBe(true)
    expect(screen.getAllByLabelText("O'chirish").every(
      (button) => button.props.accessibilityState.disabled === true
    )).toBe(true)
  })

  it('renders member actions below the full-width member summary', async () => {
    const screen = renderSheet()
    const row = await screen.findByTestId('team-member-active-1')

    expect(row.children[0]?.props.testID).toBe('team-member-summary-active-1')
    expect(row.children[1]?.props.testID).toBe('team-member-actions-active-1')
    expect(screen.getAllByLabelText('Xodimni tahrirlash')).toHaveLength(2)
  })
})
