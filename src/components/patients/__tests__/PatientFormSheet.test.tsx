import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import PatientFormSheet, { buildPatientPayload } from '../PatientFormSheet'
import { I18nProvider } from '../../../i18n'
import {
  createPatient,
  getPatient,
  listCategories,
  updatePatient,
} from '../../../api/patients'

jest.mock('../../ui/BottomSheet', () => {
  const React = require('react')
  const { Text, View } = require('react-native')
  return function MockBottomSheet({ visible, title, children }: any) {
    return visible
      ? React.createElement(
          View,
          null,
          React.createElement(Text, null, title),
          children
        )
      : null
  }
})
jest.mock('../../ui/InputCard', () => {
  const React = require('react')
  const { TextInput } = require('react-native')
  return function MockInputCard({ containerStyle: _containerStyle, ...props }: any) {
    return React.createElement(TextInput, props)
  }
})
jest.mock('../../ui/PatientAvatar', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return function MockPatientAvatar({ name }: { name: string }) {
    return React.createElement(Text, null, name)
  }
})
jest.mock('../../ui/DateWheelPicker', () => () => null)
jest.mock('../../gallery', () => ({ ImagePickerSheet: () => null }))
jest.mock('../../ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}))
jest.mock('../../../api/patients', () => ({
  getPatient: jest.fn(),
  createPatient: jest.fn(),
  updatePatient: jest.fn(),
  listCategories: jest.fn(),
  uploadPatientPhoto: jest.fn(),
  deletePatientPhoto: jest.fn(),
}))

const patient = (id: string, fullName: string) => ({
  id,
  patient_id: `P-${id}`,
  full_name: fullName,
  phone: '+998901234567',
  secondary_phone: '+998909876543',
  date_of_birth: '1990-01-01',
  address: 'Tashkent',
  allergies: 'Penicillin',
  current_medications: 'Vitamin D',
  medical_history: 'History',
  categories: [],
})

function tree(queryClient: QueryClient, patientId?: string | null) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <I18nProvider defaultLocale="uz">
          <PatientFormSheet visible patientId={patientId} onClose={jest.fn()} />
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

describe('<PatientFormSheet />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getPatient).mockReset()
    jest.mocked(createPatient).mockReset()
    jest.mocked(updatePatient).mockReset()
    jest.mocked(listCategories).mockResolvedValue([])
  })

  it('sends nulls when optional edit fields are cleared', () => {
    expect(
      buildPatientPayload(
        {
          name: ' Ali Karimov ',
          phone: '+998 90 123 45 67',
          secondaryPhone: '',
          dob: '',
          address: '   ',
          allergies: '',
          medications: '',
          history: '',
          categoryId: null,
        },
        true
      )
    ).toEqual({
      full_name: 'Ali Karimov',
      phone: '+998901234567',
      secondary_phone: null,
      date_of_birth: null,
      address: null,
      allergies: null,
      current_medications: null,
      medical_history: null,
      category_id: null,
    })
  })

  it('does not expose the previous patient while another edit is loading', async () => {
    let resolveSecond!: (value: ReturnType<typeof patient>) => void
    jest.mocked(getPatient).mockImplementation((id) => {
      if (id === 'p-1') return Promise.resolve(patient('p-1', 'First Patient'))
      return new Promise((resolve) => {
        resolveSecond = resolve
      })
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const screen = render(tree(queryClient, 'p-1'))

    expect(await screen.findByDisplayValue('First Patient')).toBeTruthy()

    screen.rerender(tree(queryClient, 'p-2'))
    await waitFor(() => expect(getPatient).toHaveBeenCalledWith('p-2'))
    expect(screen.queryByDisplayValue('First Patient')).toBeNull()
    expect(screen.getByText('Yuklanmoqda...')).toBeTruthy()

    resolveSecond(patient('p-2', 'Second Patient'))
    expect(await screen.findByDisplayValue('Second Patient')).toBeTruthy()
    screen.unmount()
  })

  it('keeps optional create fields collapsed until they are requested', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const screen = render(tree(queryClient, null))

    expect(await screen.findByText('Qo‘shimcha ma’lumotlar')).toBeTruthy()
    expect(screen.getByPlaceholderText('Ism Familiya')).toBeTruthy()
    expect(screen.getByPlaceholderText('+998 90 123 45 67')).toBeTruthy()
    expect(screen.queryByPlaceholderText('To‘liq manzil')).toBeNull()
    expect(screen.queryByLabelText("Qo'shimcha telefon")).toBeNull()
    expect(screen.queryByText('Rasmni olib tashlash')).toBeNull()

    fireEvent.press(screen.getByText('Qo‘shimcha ma’lumotlar'))

    expect(screen.getByLabelText("Qo'shimcha telefon")).toBeTruthy()
    expect(screen.getByPlaceholderText("To'liq manzil")).toBeTruthy()
    expect(screen.getByLabelText('Allergiya')).toBeTruthy()
  })

  it('uses the compact collapsed layout for edit without dropping hidden data', async () => {
    jest.mocked(getPatient).mockResolvedValue(patient('p-1', 'Ali Karimov'))
    jest.mocked(updatePatient).mockResolvedValue(patient('p-1', 'Ali Karimov'))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const screen = render(tree(queryClient, 'p-1'))

    expect(await screen.findByDisplayValue('Ali Karimov')).toBeTruthy()
    expect(screen.getByTestId('patient-form-compact-layout')).toBeTruthy()
    expect(screen.queryByDisplayValue('Tashkent')).toBeNull()
    expect(screen.queryByLabelText("Qo'shimcha telefon")).toBeNull()

    fireEvent.press(screen.getByText('Saqlash'))

    await waitFor(() => {
      expect(updatePatient).toHaveBeenCalledWith('p-1', {
        full_name: 'Ali Karimov',
        phone: '+998901234567',
        secondary_phone: '+998909876543',
        date_of_birth: '1990-01-01',
        address: 'Tashkent',
        allergies: 'Penicillin',
        current_medications: 'Vitamin D',
        medical_history: 'History',
        category_id: null,
      })
    })
  })

  it('uses a compact, on-demand category selector in create mode', async () => {
    jest.mocked(listCategories).mockResolvedValue([
      { id: 'vip', name: 'VIP', color: '#0F9F91' },
    ])
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const screen = render(tree(queryClient, null))

    const selector = await screen.findByText(
      'Kategoriya tanlang (ixtiyoriy)'
    )
    fireEvent.press(selector)
    fireEvent.press(await screen.findByText('VIP'))

    expect(screen.getByText('VIP')).toBeTruthy()
    expect(
      screen.queryByText('Kategoriya tanlang (ixtiyoriy)')
    ).toBeNull()
  })

  it('shows a retryable category error instead of silently hiding the field', async () => {
    jest.mocked(listCategories)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([{ id: 'vip', name: 'VIP', color: '#0F9F91' }])
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const screen = render(tree(queryClient, null))

    expect(await screen.findByText('Kategoriyalar yuklanmadi')).toBeTruthy()
    fireEvent.press(screen.getByText('Qayta urinish'))

    expect(
      await screen.findByText('Kategoriya tanlang (ixtiyoriy)')
    ).toBeTruthy()
    expect(screen.queryByText('Kategoriyalar yuklanmadi')).toBeNull()
  })

  it('creates a patient from only the two required quick fields', async () => {
    jest.mocked(createPatient).mockResolvedValue(
      patient('created-1', 'Ali Karimov')
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const screen = render(tree(queryClient, null))

    fireEvent.changeText(
      await screen.findByPlaceholderText('Ism Familiya'),
      'Ali Karimov'
    )
    fireEvent.changeText(
      screen.getByPlaceholderText('+998 90 123 45 67'),
      '+998 90 123 45 67'
    )
    fireEvent.press(screen.getByText('Yaratish'))

    await waitFor(() => {
      expect(createPatient).toHaveBeenCalledWith({
        full_name: 'Ali Karimov',
        phone: '+998901234567',
        secondary_phone: undefined,
        date_of_birth: undefined,
        address: undefined,
        allergies: undefined,
        current_medications: undefined,
        medical_history: undefined,
        category_id: null,
      })
    })
  })
})
