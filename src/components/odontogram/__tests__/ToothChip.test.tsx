import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import ToothChip from '../ToothChip'

describe('<ToothChip />', () => {
  it('renders the tooth number', () => {
    const { getByText } = render(<ToothChip number={11} />)
    expect(getByText('11')).toBeTruthy()
  })

  it('fires onPress with the tooth number', () => {
    const onPress = jest.fn()
    const { getByText } = render(<ToothChip number={21} onPress={onPress} />)
    fireEvent.press(getByText('21'))
    expect(onPress).toHaveBeenCalledWith(21)
  })

  it('ignores onPress when disabled', () => {
    const onPress = jest.fn()
    const { getByText } = render(<ToothChip number={11} onPress={onPress} disabled />)
    fireEvent.press(getByText('11'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('does NOT throw when no onPress handler is supplied', () => {
    const { getByText } = render(<ToothChip number={11} />)
    expect(() => fireEvent.press(getByText('11'))).not.toThrow()
  })

  it('renders a badge when badge > 0', () => {
    const { getByText } = render(<ToothChip number={11} badge={3} />)
    expect(getByText('3')).toBeTruthy()
  })

  it('does not render a badge when badge is 0', () => {
    const { queryByText } = render(<ToothChip number={11} badge={0} />)
    expect(queryByText('0')).toBeNull()
  })

  it('caps badge at "9+" for double-digit counts', () => {
    const { getByText } = render(<ToothChip number={11} badge={42} />)
    expect(getByText('9+')).toBeTruthy()
  })

  it('applies accessibility label "Tish N"', () => {
    const { getByLabelText } = render(<ToothChip number={11} onPress={() => {}} />)
    expect(getByLabelText('Tish 11')).toBeTruthy()
  })
})
