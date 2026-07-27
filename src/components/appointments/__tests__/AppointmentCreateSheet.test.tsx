import React from 'react'
import { StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import AppointmentCreateSheet from '../AppointmentCreateSheet'
import { I18nProvider } from '../../../i18n'
import { ToastProvider } from '../../ui/Toast'
import { getProfile } from '../../../api/profile'
import { listAppointments } from '../../../api/appointments'
import { lookupPatients } from '../../../api/patients'

jest.mock('../../ui/BottomSheet', () => {
  const React = require('react')
  const { Text, View } = require('react-native')
  return function MockBottomSheet({ visible, title, children, footer }: any) {
    return visible
      ? React.createElement(
          View,
          null,
          React.createElement(Text, null, title),
          children,
          footer
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
jest.mock('../../../api/profile', () => ({ getProfile: jest.fn() }))
jest.mock('../../../api/patients', () => ({ lookupPatients: jest.fn() }))
jest.mock('../../../api/appointments', () => ({
  createAppointment: jest.fn(),
  listAppointments: jest.fn(),
}))

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
}

describe('<AppointmentCreateSheet /> polish', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    jest.mocked(getProfile).mockResolvedValue({
      working_hours: { start: '09:00', end: '12:00' },
    } as Awaited<ReturnType<typeof getProfile>>)
    jest.mocked(listAppointments).mockResolvedValue({
      data: [],
      meta: {
        pagination: { current_page: 1, last_page: 1, per_page: 0, total: 0 },
      },
    })
    jest.mocked(lookupPatients).mockResolvedValue({
      data: [
        {
          id: 'p-1',
          patient_id: 'P-1',
          full_name: 'Ali Karimov',
          phone: '+998901234567',
          secondary_phone: null,
        },
        {
          id: 'p-2',
          patient_id: 'P-2',
          full_name: 'Anvar Rasulov',
          phone: '+998901111111',
          secondary_phone: null,
        },
        {
          id: 'p-3',
          patient_id: 'P-3',
          full_name: 'Aziza Rahimova',
          phone: '+998902222222',
          secondary_phone: null,
        },
        {
          id: 'p-4',
          patient_id: 'P-4',
          full_name: 'Akmal Saidov',
          phone: '+998903333333',
          secondary_phone: null,
        },
      ],
      meta: {
        pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
      },
    })
  })

  it('uses the compact patient search, date and time UI with the web reason copy', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const screen = render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider defaultLocale="uz">
            <ToastProvider>
              <AppointmentCreateSheet
                visible
                defaultDate={new Date(2030, 0, 15)}
                onClose={jest.fn()}
              />
            </ToastProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )

    const searchInput = screen.getByPlaceholderText('Ism yoki telefon orqali qidiring')
    expect(StyleSheet.flatten(searchInput.props.style).paddingVertical).toBe(10)
    expect(screen.queryByText('Ertaga')).toBeNull()
    expect(screen.getByPlaceholderText('Masalan, ko‘rik, plomba')).toBeTruthy()
    expect(screen.getByText('Restavratsiya')).toBeTruthy()
    expect(screen.getByText('Endodontiya')).toBeTruthy()
    expect(screen.getByText('Olib tashlash')).toBeTruthy()
    expect(screen.getByText('Implantatsiya')).toBeTruthy()
    expect(screen.getByText('Oqartirish')).toBeTruthy()
    expect(screen.getByText('Ortopediya')).toBeTruthy()
    expect(screen.getByText('Tozalash')).toBeTruthy()
    expect(screen.queryByText('Boshqa')).toBeNull()
    expect(screen.getByTestId('appointment-reason-strip')).toBeTruthy()

    fireEvent.press(screen.getByTestId('appointment-date-selector'))
    expect(screen.getByText('Sanani tanlash')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByTestId('appointment-time-selector')).toBeEnabled()
    })

    expect(
      StyleSheet.flatten(screen.getByTestId('appointment-time-selector').props.style)
    ).toMatchObject({ height: 44 })
    expect(screen.getByTestId('appointment-time-selector-label')).toHaveTextContent('Vaqt')
    expect(screen.getByTestId('appointment-time-selector-value')).toHaveTextContent(
      '09:00–09:30'
    )

    fireEvent.press(screen.getByTestId('appointment-time-selector'))
    expect(screen.getByTestId('appointment-time-option-09:00')).toBeTruthy()

    fireEvent.press(screen.getByTestId('appointment-duration-selector'))
    expect(screen.getByTestId('appointment-duration-option-30')).toBeTruthy()

  })

  it('matches the backend by excluding already elapsed slots today', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2030, 0, 15, 10, 5, 0, 0))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const screen = render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider defaultLocale="uz">
            <ToastProvider>
              <AppointmentCreateSheet
                visible
                defaultDate={new Date(2030, 0, 15)}
                onClose={jest.fn()}
              />
            </ToastProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('appointment-time-selector-value')).toHaveTextContent(
        '10:30–11:00'
      )
    })

    fireEvent.press(screen.getByTestId('appointment-time-selector'))
    expect(screen.queryByTestId('appointment-time-option-10:00')).toBeNull()
    expect(screen.getByTestId('appointment-time-option-10:30')).toBeTruthy()
    screen.unmount()
  })

  it('searches the global patient lookup and renders its result', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const screen = render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider defaultLocale="uz">
            <ToastProvider>
              <AppointmentCreateSheet
                visible
                defaultDate={new Date(2030, 0, 15)}
                onClose={jest.fn()}
              />
            </ToastProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )

    await waitFor(() => {
      expect(lookupPatients).toHaveBeenCalledWith(
        { search: undefined, page: 1, per_page: 20 },
        { signal: expect.anything() }
      )
    })

    fireEvent.changeText(
      screen.getByPlaceholderText('Ism yoki telefon orqali qidiring'),
      'A'
    )

    // The already-loaded directory is filtered immediately; the debounced
    // server lookup then refreshes it for global results.
    expect(screen.getByText('Ali Karimov')).toBeTruthy()
    expect(screen.getByText('Anvar Rasulov')).toBeTruthy()
    expect(screen.getByText('Aziza Rahimova')).toBeTruthy()
    expect(screen.queryByText('Akmal Saidov')).toBeNull()
    expect(screen.getByLabelText('Ali Karimov, +998901234567')).toBeTruthy()
    expect(
      StyleSheet.flatten(screen.getByTestId('appointment-patient-search-results').props.style)
    ).toMatchObject({ position: 'absolute' })

    fireEvent.changeText(
      screen.getByPlaceholderText('Ism yoki telefon orqali qidiring'),
      'Ali'
    )
    expect(screen.getByText('Ali Karimov')).toBeTruthy()
    expect(screen.queryByText('Anvar Rasulov')).toBeNull()
    expect(screen.queryByText('Aziza Rahimova')).toBeNull()

    await waitFor(
      () => {
        expect(lookupPatients).toHaveBeenCalledWith(
          { search: 'Ali', page: 1, per_page: 3 },
          { signal: expect.anything() }
        )
      },
      { timeout: 2000 }
    )
    expect(await screen.findByText('Ali Karimov')).toBeTruthy()

    screen.unmount()
  })
})
