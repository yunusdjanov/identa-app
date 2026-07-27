import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { I18nProvider } from '../../../i18n'
import { useAuthStore } from '../../../stores/auth'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../../../api/patients'
import PatientCategoriesSheet from '../PatientCategoriesSheet'

jest.mock('../../ui/BottomSheet', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const { View } = require('react-native')
    return visible ? <View>{children}</View> : null
  },
}))

// InputCard's focus animation is visual-only and is exercised by its own UI
// tests. A plain input keeps this sheet test deterministic after unmount.
jest.mock('../../ui/InputCard', () => ({
  __esModule: true,
  default: ({
    iconName: _iconName,
    error: _error,
    errorMessage: _errorMessage,
    containerStyle: _containerStyle,
    ...inputProps
  }: Record<string, unknown>) => {
    const React = require('react')
    const { TextInput } = require('react-native')
    return React.createElement(TextInput, inputProps)
  },
}))

jest.mock('../../../api/patients', () => ({
  listCategories: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
}))

jest.mock('../../ui/Toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}))

jest.mock('../../ui/Dialog', () => ({
  useDialog: () => ({ confirm: jest.fn().mockResolvedValue(false) }),
}))

function renderSheet() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale="uz">
        <PatientCategoriesSheet visible onClose={jest.fn()} />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('PatientCategoriesSheet accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({
      user: {
        id: 'dentist-1',
        name: 'Dentist',
        email: 'dentist@example.test',
        role: 'dentist',
        account_status: 'active',
      },
      isAuthenticated: true,
    } as never)
    jest.mocked(listCategories).mockResolvedValue([
      { id: 'cat-1', name: 'Bolalar', color: '#3B82F6' },
    ])
    jest.mocked(createCategory).mockResolvedValue({ id: 'cat-2', name: 'VIP', color: '#A855F7' })
    jest.mocked(updateCategory).mockResolvedValue({ id: 'cat-1', name: 'Bolalar', color: '#3B82F6' })
    jest.mocked(deleteCategory).mockResolvedValue(undefined)
  })

  it('labels category actions and exposes selected color state', async () => {
    const screen = renderSheet()

    expect(await screen.findByLabelText('Bolalar kategoriyasini tahrirlash')).toBeTruthy()
    expect(screen.getByLabelText('Bolalar kategoriyasini o‘chirish')).toBeTruthy()

    fireEvent.press(screen.getByText('Yangi kategoriya'))

    expect(screen.getByLabelText('1-rangni tanlash')).toHaveAccessibilityState({
      selected: true,
    })
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(8)
  })
})
