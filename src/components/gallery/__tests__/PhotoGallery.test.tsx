import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import PhotoGallery, { type GalleryPhoto } from '../PhotoGallery'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'

const remote = (id: string, url = 'https://cdn/img.jpg'): GalleryPhoto => ({
  kind: 'remote',
  id,
  url,
})
const local = (id: string, uri = 'file:///photo.jpg'): GalleryPhoto => ({
  kind: 'local',
  localId: id,
  uri,
})

describe('<PhotoGallery />', () => {
  it('renders an empty state when no photos and no add handler', () => {
    const { getByText } = renderWithProviders(<PhotoGallery photos={[]} />)
    expect(getByText('Hali surat yo\'q')).toBeTruthy()
  })

  it('renders the Add tile when onPressAdd is provided', () => {
    const onPressAdd = jest.fn()
    const { getByText } = renderWithProviders(
      <PhotoGallery photos={[]} onPressAdd={onPressAdd} />
    )
    // The Add tile label.
    fireEvent.press(getByText("Qo'shish"))
    expect(onPressAdd).toHaveBeenCalled()
  })

  it('hides the Add tile when max photos reached', () => {
    const photos = Array.from({ length: 3 }, (_, i) => remote(`r-${i}`))
    const { queryByText } = renderWithProviders(
      <PhotoGallery photos={photos} onPressAdd={() => {}} maxPhotos={3} />
    )
    expect(queryByText("Qo'shish")).toBeNull()
  })

  it('renders the counter when maxPhotos is set', () => {
    const photos = [remote('r-1'), remote('r-2')]
    const { getByText } = renderWithProviders(
      <PhotoGallery photos={photos} maxPhotos={10} />
    )
    expect(getByText('2/10')).toBeTruthy()
  })

  it('fires onPressPhoto with the correct index when a thumbnail is tapped', () => {
    const onPressPhoto = jest.fn()
    const photos = [remote('a'), remote('b'), remote('c')]
    const { getByLabelText } = renderWithProviders(
      <PhotoGallery photos={photos} onPressPhoto={onPressPhoto} />
    )
    fireEvent.press(getByLabelText('2-rasmni ochish'))
    expect(onPressPhoto).toHaveBeenCalledWith(1)
  })

  it('fires onRemovePhoto with the photo object when X is tapped', () => {
    const onRemovePhoto = jest.fn()
    const photo = remote('a')
    const { getByLabelText } = renderWithProviders(
      <PhotoGallery photos={[photo]} onRemovePhoto={onRemovePhoto} />
    )
    fireEvent.press(getByLabelText("O'chirish"))
    expect(onRemovePhoto).toHaveBeenCalledWith(photo)
  })

  it('omits the title header when bare=true', () => {
    const { queryByText } = renderWithProviders(
      <PhotoGallery photos={[remote('a')]} bare />
    )
    expect(queryByText('Suratlar')).toBeNull()
  })

  it('uses the intermediate 76px tile in dense forms', () => {
    const { getByTestId } = renderWithProviders(
      <PhotoGallery photos={[]} onPressAdd={() => {}} size="form" bare />
    )

    expect(StyleSheet.flatten(getByTestId('gallery-add-tile').props.style)).toMatchObject({
      width: 76,
      height: 76,
    })
  })
})
