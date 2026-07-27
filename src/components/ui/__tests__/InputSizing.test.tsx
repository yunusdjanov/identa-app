import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { render } from '@testing-library/react-native'

import FormRow from '../FormRow'
import Input from '../Input'
import InputCard from '../InputCard'
import SearchBar from '../SearchBar'
import { inputMetrics, radius } from '../../../constants/theme'

type QueriedNode = ReturnType<ReturnType<typeof render>['getByPlaceholderText']>

function ancestorStyleWith(input: QueriedNode, property: string) {
  let current = input.parent

  while (current) {
    const style = StyleSheet.flatten(current.props.style)
    if (style && Object.prototype.hasOwnProperty.call(style, property)) {
      return style
    }
    current = current.parent
  }

  return undefined
}

describe('single-line input sizing', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('keeps the shared compact metrics stable', () => {
    expect(inputMetrics).toMatchObject({
      height: 44,
      paddingHorizontal: 12,
      fontSize: 14,
      lineHeight: 19,
      iconSize: 20,
    })
  })

  it('applies the standard to InputCard', () => {
    const screen = render(<InputCard placeholder="Card input" iconName="person-outline" />)
    const input = screen.getByPlaceholderText('Card input')

    expect(ancestorStyleWith(input, 'minHeight')).toMatchObject({
      minHeight: inputMetrics.height,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      borderRadius: radius.lg,
    })
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
    })
  })

  it('applies the standard to Input and FormRow', () => {
    const inputScreen = render(<Input placeholder="Base input" />)
    const input = inputScreen.getByPlaceholderText('Base input')
    expect(ancestorStyleWith(input, 'height')).toMatchObject({
      height: inputMetrics.height,
      paddingHorizontal: inputMetrics.paddingHorizontal,
    })
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
    })

    const rowScreen = render(
      <FormRow placeholder="Form row" icon={<Text accessibilityLabel="icon">I</Text>} />
    )
    const row = rowScreen.getByPlaceholderText('Form row')
    expect(ancestorStyleWith(row, 'minHeight')).toMatchObject({
      minHeight: inputMetrics.height,
      paddingHorizontal: inputMetrics.paddingHorizontal,
    })
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
    })
  })

  it('applies the standard to SearchBar', () => {
    const screen = render(
      <SearchBar value="" onChangeText={() => {}} placeholder="Search input" />
    )
    const input = screen.getByPlaceholderText('Search input')

    expect(ancestorStyleWith(input, 'height')).toMatchObject({
      height: inputMetrics.height,
      paddingHorizontal: inputMetrics.paddingHorizontal,
      borderRadius: radius.lg,
    })
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      fontSize: inputMetrics.fontSize,
      lineHeight: inputMetrics.lineHeight,
    })
  })
})
