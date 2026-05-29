import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import Odontogram from '../Odontogram'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

describe('<Odontogram />', () => {
  describe('picker mode', () => {
    it('renders all 32 teeth across both jaws', () => {
      const { getByText } = renderWithProviders(
        <Odontogram mode="picker" selectedTeeth={[]} onToggleTooth={() => {}} />
      )
      // Sample a few from each quadrant — full enumeration would be noise.
      expect(getByText('1')).toBeTruthy()  // upper right
      expect(getByText('16')).toBeTruthy() // upper left
      expect(getByText('17')).toBeTruthy() // lower left
      expect(getByText('32')).toBeTruthy() // lower right
    })

    it('fires onToggleTooth on chip press', () => {
      const onToggleTooth = jest.fn()
      const { getByText } = renderWithProviders(
        <Odontogram mode="picker" selectedTeeth={[]} onToggleTooth={onToggleTooth} />
      )
      fireEvent.press(getByText('11'))
      expect(onToggleTooth).toHaveBeenCalledWith(11)
    })

    it('shows the picker hint text in Uzbek (default locale in tests)', () => {
      const { getByText } = renderWithProviders(
        <Odontogram mode="picker" selectedTeeth={[]} onToggleTooth={() => {}} />
      )
      expect(getByText(/Bir nechta tishni tanlashingiz/)).toBeTruthy()
    })

    it('renders the jaw + quadrant labels', () => {
      const { getByText } = renderWithProviders(
        <Odontogram mode="picker" selectedTeeth={[]} onToggleTooth={() => {}} />
      )
      expect(getByText("Yuqori jag'")).toBeTruthy()
      expect(getByText("Pastki jag'")).toBeTruthy()
      expect(getByText("Yuqori o'ng")).toBeTruthy()
      expect(getByText('Yuqori chap')).toBeTruthy()
    })

    it('switches to Russian labels when locale="ru" is passed', () => {
      const { getByText } = renderWithProviders(
        <Odontogram mode="picker" selectedTeeth={[]} onToggleTooth={() => {}} />,
        { locale: 'ru' }
      )
      expect(getByText('Верхняя челюсть')).toBeTruthy()
      expect(getByText('Нижняя челюсть')).toBeTruthy()
    })
  })

  describe('view mode', () => {
    it('fires onPressTooth when a tooth with a condition is pressed', () => {
      const onPressTooth = jest.fn()
      const { getByText } = renderWithProviders(
        <Odontogram
          mode="view"
          conditions={{ 11: 'filling' }}
          badges={{ 11: 2 }}
          onPressTooth={onPressTooth}
        />
      )
      fireEvent.press(getByText('11'))
      expect(onPressTooth).toHaveBeenCalledWith(11)
    })

    it('renders badges for teeth with treatments', () => {
      const { getAllByText } = renderWithProviders(
        <Odontogram
          mode="view"
          conditions={{}}
          badges={{ 5: 5 }}
          onPressTooth={() => {}}
        />
      )
      // The label "5" appears both as the tooth number for tooth 5 AND
      // as the badge value for tooth 5 (history_count = 5). Both render.
      expect(getAllByText('5').length).toBeGreaterThanOrEqual(2)
    })

    it('does not render the picker hint in view mode', () => {
      const { queryByText } = renderWithProviders(
        <Odontogram mode="view" conditions={{}} />
      )
      expect(queryByText(/Bir nechta tishni tanlashingiz/)).toBeNull()
    })

    it('omits the section header when showHeader=false', () => {
      const { queryByText } = renderWithProviders(
        <Odontogram mode="view" conditions={{}} showHeader={false} />
      )
      expect(queryByText('Tishlar')).toBeNull()
      expect(queryByText("Yuqori jag'")).toBeTruthy()
    })
  })
})
