import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { I18nProvider } from '../../../i18n'
import { listAuditLogs } from '../../../api/audit'
import AuditLogsSheet from '../AuditLogsSheet'

jest.mock('../../ui/BottomSheet', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const { View } = require('react-native')
    return visible ? <View>{children}</View> : null
  },
}))

jest.mock('../../../api/audit', () => ({
  listAuditLogs: jest.fn(),
}))

function renderSheet() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLocale="uz">
        <AuditLogsSheet visible onClose={jest.fn()} />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('AuditLogsSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(listAuditLogs).mockResolvedValue({
      data: [],
      meta: {
        pagination: {
          page: 1,
          per_page: 10,
          total: 0,
          total_pages: 1,
        },
      },
    })
  })

  it('does not refetch for a one-character search and caps real searches to the API contract', async () => {
    const screen = renderSheet()
    const input = await screen.findByPlaceholderText("Hodisa yoki obyekt bo'yicha qidirish")
    await waitFor(() => expect(listAuditLogs).toHaveBeenCalledTimes(1))

    fireEvent.changeText(input, 'a')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    expect(listAuditLogs).toHaveBeenCalledTimes(1)

    fireEvent.changeText(input, `ab${'c'.repeat(120)}`)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    await waitFor(() => expect(listAuditLogs).toHaveBeenCalledTimes(2))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(listAuditLogs).toHaveBeenLastCalledWith({
      page: 1,
      per_page: 10,
      search: `ab${'c'.repeat(98)}`,
    })
    expect(screen.getByLabelText('Tozalash')).toBeTruthy()
  })
})
