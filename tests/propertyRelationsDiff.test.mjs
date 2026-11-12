import test from 'node:test'
import assert from 'node:assert/strict'
import { diffAmenities, diffImages } from '../src/utils/propertyRelationsDiff.js'

const rows = [
  { id: 'a', image_url: 'u/a.jpg', is_thumbnail: true, display_order: 0 },
  { id: 'b', image_url: 'u/b.jpg', is_thumbnail: false, display_order: 1 },
  { id: 'c', image_url: 'u/c.jpg', is_thumbnail: false, display_order: 2 },
]

test('unchanged amenities produce no writes', () => {
  assert.deepEqual(diffAmenities(['Lift', 'WiFi'], ['WiFi', 'Lift']), { toAdd: [], toRemove: [] })
})

test('amenity diff only lists the differences', () => {
  assert.deepEqual(diffAmenities(['Lift', 'WiFi'], ['WiFi', 'AC', 'CCTV']), {
    toAdd: ['AC', 'CCTV'],
    toRemove: ['Lift'],
  })
})

test('amenity diff ignores duplicates and blanks', () => {
  assert.deepEqual(diffAmenities(['Lift', 'Lift'], ['Lift', 'AC', 'AC', '']), {
    toAdd: ['AC'],
    toRemove: [],
  })
  assert.deepEqual(diffAmenities(undefined, undefined), { toAdd: [], toRemove: [] })
})

test('unchanged images produce no writes', () => {
  assert.deepEqual(diffImages(rows, rows.map((row) => row.image_url), []), {
    toDeleteIds: [],
    toInsert: [],
    toUpdate: [],
  })
})

test('unchanged images are left alone even when stored ordering is irregular', () => {
  const legacy = [
    { id: 'a', image_url: 'u/a.jpg', is_thumbnail: false, display_order: null },
    { id: 'b', image_url: 'u/b.jpg', is_thumbnail: false, display_order: 5 },
  ]
  assert.deepEqual(diffImages(legacy, ['u/a.jpg', 'u/b.jpg'], []), {
    toDeleteIds: [],
    toInsert: [],
    toUpdate: [],
  })
})

test('removing the first image deletes it and promotes the next to thumbnail', () => {
  assert.deepEqual(diffImages(rows, ['u/b.jpg', 'u/c.jpg'], []), {
    toDeleteIds: ['a'],
    toInsert: [],
    toUpdate: [
      { id: 'b', display_order: 0, is_thumbnail: true },
      { id: 'c', display_order: 1, is_thumbnail: false },
    ],
  })
})

test('a new image is appended after the kept ones', () => {
  assert.deepEqual(diffImages(rows, rows.map((row) => row.image_url), ['u/new.jpg']), {
    toDeleteIds: [],
    toInsert: [{ image_url: 'u/new.jpg', display_order: 3, is_thumbnail: false }],
    toUpdate: [],
  })
})

test('replacing every image makes the first upload the thumbnail', () => {
  assert.deepEqual(diffImages(rows, [], ['u/x.jpg', 'u/y.jpg']), {
    toDeleteIds: ['a', 'b', 'c'],
    toInsert: [
      { image_url: 'u/x.jpg', display_order: 0, is_thumbnail: true },
      { image_url: 'u/y.jpg', display_order: 1, is_thumbnail: false },
    ],
    toUpdate: [],
  })
})

test('removing a url removes every stored row that has it', () => {
  const duplicated = [...rows, { id: 'd', image_url: 'u/a.jpg', is_thumbnail: false, display_order: 3 }]
  assert.deepEqual(diffImages(duplicated, ['u/b.jpg', 'u/c.jpg'], []).toDeleteIds, ['a', 'd'])
})
