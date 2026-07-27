import React from 'react'
import { StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native'

import TreatmentEditSheet from '../TreatmentEditSheet'
import { I18nProvider } from '../../../i18n'
import { useAuthStore } from '../../../stores/auth'
import {
  createPatientTreatment,
  getPatientTreatment,
  updatePatientTreatment,
} from '../../../api/treatments'
import type { ApiTreatment } from '../../../types'

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
  return {
    __esModule: true,
    default: ({ containerStyle: _containerStyle, ...props }: any) =>
      React.createElement(TextInput, props),
  }
})

jest.mock('../../ui/Button', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return function MockButton({ title, onPress, disabled, loading }: any) {
    return React.createElement(
      Pressable,
      {
        onPress,
        disabled: disabled || loading,
        accessibilityRole: 'button',
        accessibilityLabel: title,
      },
      React.createElement(Text, null, title)
    )
  }
})

jest.mock('../../ui/SegmentedControl', () => {
  const React = require('react')
  const { Pressable, Text, View } = require('react-native')
  return function MockSegmentedControl({ options, value, onChange }: any) {
    return React.createElement(
      View,
      null,
      options.map((option: any) =>
        React.createElement(
          Pressable,
          {
            key: option.value,
            onPress: () => onChange(option.value),
            accessibilityRole: 'button',
            accessibilityState: { selected: option.value === value },
          },
          React.createElement(Text, null, option.label)
        )
      )
    )
  }
})

jest.mock('../../ui/MonthCalendarPicker', () => () => null)

jest.mock('../../ui/Dialog', () => ({
  useDialog: () => ({ confirm: jest.fn() }),
}))

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
}

jest.mock('../../ui/Toast', () => ({
  useToast: () => mockToast,
}))

jest.mock('../../gallery', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    PhotoGallery: () => React.createElement(View, { testID: 'treatment-photo-gallery' }),
    ImagePickerSheet: () => null,
    LightboxViewer: () => null,
  }
})

jest.mock('../../../api/treatments', () => ({
  createPatientTreatment: jest.fn(),
  updatePatientTreatment: jest.fn(),
  deletePatientTreatment: jest.fn(),
  uploadTreatmentImage: jest.fn(),
  deleteTreatmentImage: jest.fn(),
  getPatientTreatment: jest.fn(),
  resolveTreatmentImageUrl: jest.fn(),
}))

const savedTreatment: ApiTreatment = {
  id: 'treatment-1',
  patient_id: 'patient-1',
  teeth: [],
  treatment_type: 'Restavratsiya',
  treatment_date: '2026-07-22',
  cost: 25.5,
  debt_amount: 25.5,
  paid_amount: 10,
  balance: 15.5,
  currency: 'USD',
  images: [],
}

function renderSheet(treatment?: ApiTreatment) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onClose = jest.fn()
  const screen = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale="uz">
        <TreatmentEditSheet
          visible
          patientId="patient-1"
          treatment={treatment}
          onClose={onClose}
        />
      </I18nProvider>
    </QueryClientProvider>
  )
  return { ...screen, onClose }
}

describe('<TreatmentEditSheet /> web parity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({
      user: {
        id: 'dentist-1',
        name: 'Dentist',
        email: 'dentist@example.com',
        role: 'dentist',
        account_status: 'active',
        subscription: { entry_image_limit: 10 },
      },
    } as any)
    jest.mocked(createPatientTreatment).mockResolvedValue(savedTreatment)
    jest.mocked(updatePatientTreatment).mockResolvedValue(savedTreatment)
    jest.mocked(getPatientTreatment).mockResolvedValue(savedTreatment)
  })

  afterEach(() => {
    cleanup()
    act(() => {
      useAuthStore.setState({ user: null } as any)
    })
  })

  it('shows web treatment suggestions and currency controls without odontogram UI', () => {
    const screen = renderSheet()

    expect(screen.getByText('Restavratsiya')).toBeTruthy()
    expect(screen.getByText('Endodontiya')).toBeTruthy()
    expect(screen.getByText('Olib tashlash')).toBeTruthy()
    expect(screen.getByText('Implantatsiya')).toBeTruthy()
    expect(screen.getByText('Oqartirish')).toBeTruthy()
    expect(screen.getByText('Ortopediya')).toBeTruthy()
    expect(screen.getByText('Tozalash')).toBeTruthy()
    expect(screen.getByText('UZS')).toBeTruthy()
    expect(screen.getByText('USD')).toBeTruthy()
    expect(screen.queryByText("Yuqori jag'")).toBeNull()
    expect(screen.queryByText("Pastki jag'")).toBeNull()
    expect(
      StyleSheet.flatten(screen.getByTestId('treatment-date-control').props.style)
    ).toMatchObject({
      width: '100%',
      height: 44,
      backgroundColor: '#FFFFFF',
      borderWidth: 1.2,
      borderColor: 'rgba(60, 60, 67, 0.29)',
    })
    expect(
      StyleSheet.flatten(screen.getByTestId('treatment-money-work').props.style)
    ).toMatchObject({ height: 44 })
    expect(
      StyleSheet.flatten(screen.getByTestId('treatment-money-paid').props.style)
    ).toMatchObject({ height: 44 })
  })

  it('submits USD decimals and the selected web suggestion', async () => {
    const screen = renderSheet()

    fireEvent.press(screen.getByRole('button', { name: 'Restavratsiya' }))
    fireEvent.press(screen.getByText('USD'))

    const workInput = screen.getByLabelText('Ish summasi · USD')
    const paidInput = screen.getByLabelText("To'langan · USD")
    fireEvent.changeText(workInput, '25.50')
    fireEvent.changeText(paidInput, '10.25')

    expect(workInput.props.value).toBe('25.50')
    expect(paidInput.props.value).toBe('10.25')

    fireEvent.press(screen.getByLabelText("Qo'shish"))

    await waitFor(() => {
      expect(createPatientTreatment).toHaveBeenCalledWith(
        'patient-1',
        expect.objectContaining({
          treatment_type: 'Restavratsiya',
          teeth: [],
          debt_amount: 25.5,
          paid_amount: 10.25,
          currency: 'USD',
        })
      )
    })
  })

  it('preserves existing tooth links when editing without an odontogram control', async () => {
    const existing: ApiTreatment = {
      ...savedTreatment,
      id: 'existing-treatment',
      teeth: [11, 12],
      treatment_type: 'Old treatment',
    }
    const screen = renderSheet(existing)

    fireEvent.press(screen.getByLabelText('Saqlash'))

    await waitFor(() => {
      expect(updatePatientTreatment).toHaveBeenCalledWith(
        'patient-1',
        'existing-treatment',
        expect.objectContaining({ teeth: [11, 12] })
      )
    })
  })

  it('hides financial controls when the user cannot view payments', () => {
    useAuthStore.setState({
      user: {
        id: 'assistant-1',
        name: 'Assistant',
        email: 'assistant@example.com',
        role: 'assistant',
        account_status: 'active',
        assistant_permissions: ['patients.view', 'patients.manage'],
      },
    } as any)

    const screen = renderSheet()

    expect(screen.queryByText('UZS')).toBeNull()
    expect(screen.queryByText('USD')).toBeNull()
    expect(screen.queryByText('Ish summasi')).toBeNull()
  })
})
