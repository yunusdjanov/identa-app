import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import SearchBar from '../SearchBar'

describe('<SearchBar />', () => {
  it('renders the placeholder', () => {
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={() => {}} placeholder="Qidiruv..." />
    )
    expect(getByPlaceholderText('Qidiruv...')).toBeTruthy()
  })

  it('fires onChangeText as the user types', () => {
    const onChangeText = jest.fn()
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={onChangeText} placeholder="Search" />
    )
    fireEvent.changeText(getByPlaceholderText('Search'), 'Test')
    expect(onChangeText).toHaveBeenCalledWith('Test')
  })

  it('shows the clear (X) button when value is non-empty', () => {
    const onChangeText = jest.fn()
    const { getByTestId } = render(
      <SearchBar value="Test" onChangeText={onChangeText} placeholder="Search" />
    )
    fireEvent.press(getByTestId('searchbar-clear'))
    expect(onChangeText).toHaveBeenCalledWith('')
  })

  it('hides the clear button when value is empty', () => {
    const { queryByTestId } = render(
      <SearchBar value="" onChangeText={() => {}} placeholder="Search" />
    )
    expect(queryByTestId('searchbar-clear')).toBeNull()
  })

  it('shows a spinner instead of the clear button when loading', () => {
    const { getByTestId, getByLabelText, queryByTestId } = render(
      <SearchBar
        value="Test"
        onChangeText={() => {}}
        placeholder="Search"
        loading
        loadingAccessibilityLabel="Loading patients"
      />
    )
    expect(getByTestId('searchbar-spinner')).toBeTruthy()
    expect(getByLabelText('Loading patients')).toHaveAccessibilityState({ busy: true })
    // Clear button is suppressed when loading.
    expect(queryByTestId('searchbar-clear')).toBeNull()
  })

  it('shows a spinner even when value is empty (e.g. debounce-only state)', () => {
    const { getByTestId } = render(
      <SearchBar value="" onChangeText={() => {}} placeholder="Search" loading />
    )
    expect(getByTestId('searchbar-spinner')).toBeTruthy()
  })

  it('preserves caller focus and blur callbacks', () => {
    const onFocus = jest.fn()
    const onBlur = jest.fn()
    const { getByPlaceholderText } = render(
      <SearchBar
        value=""
        onChangeText={() => {}}
        placeholder="Search"
        onFocus={onFocus}
        onBlur={onBlur}
      />
    )
    const input = getByPlaceholderText('Search')

    fireEvent(input, 'focus')
    fireEvent(input, 'blur')

    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('uses the placeholder as the default accessible input label', () => {
    const { getByLabelText } = render(
      <SearchBar value="" onChangeText={() => {}} placeholder="Search patients" />
    )

    expect(getByLabelText('Search patients')).toBeTruthy()
  })
})
