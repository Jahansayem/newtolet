// Diffs between what the edit form loaded and what it is about to save, so a
// save only touches the property_amenities / property_images rows that changed.

const unique = (values = []) => [...new Set((values || []).filter(Boolean))]

/**
 * @param {string[]} loaded - amenity_type values that were loaded into the form
 * @param {string[]} selected - amenity_type values ticked at save time
 * @returns {{ toAdd: string[], toRemove: string[] }}
 */
export const diffAmenities = (loaded = [], selected = []) => {
  const loadedSet = new Set(unique(loaded))
  const selectedSet = new Set(unique(selected))

  return {
    toAdd: [...selectedSet].filter((amenity) => !loadedSet.has(amenity)),
    toRemove: [...loadedSet].filter((amenity) => !selectedSet.has(amenity)),
  }
}

/**
 * @param {{ id: string, image_url: string, is_thumbnail?: boolean, display_order?: number }[]} loadedRows
 *   property_images rows that were loaded into the form, in display order
 * @param {string[]} keptUrls - loaded image URLs the user kept
 * @param {string[]} newUrls - URLs of images uploaded during this save
 * @returns {{
 *   toDeleteIds: string[],
 *   toInsert: { image_url: string, display_order: number, is_thumbnail: boolean }[],
 *   toUpdate: { id: string, display_order: number, is_thumbnail: boolean }[],
 * }}
 */
export const diffImages = (loadedRows = [], keptUrls = [], newUrls = []) => {
  const rows = loadedRows || []
  const keptSet = new Set(keptUrls || [])
  const added = (newUrls || []).filter(Boolean)

  const keptRows = rows.filter((row) => keptSet.has(row.image_url))
  const toDeleteIds = rows.filter((row) => !keptSet.has(row.image_url)).map((row) => row.id)

  // Nothing added or removed: leave the stored rows exactly as they are.
  if (toDeleteIds.length === 0 && added.length === 0) {
    return { toDeleteIds: [], toInsert: [], toUpdate: [] }
  }

  const toUpdate = keptRows
    .map((row, index) => ({ row, display_order: index, is_thumbnail: index === 0 }))
    .filter(
      ({ row, display_order, is_thumbnail }) =>
        row.display_order !== display_order || Boolean(row.is_thumbnail) !== is_thumbnail
    )
    .map(({ row, display_order, is_thumbnail }) => ({ id: row.id, display_order, is_thumbnail }))

  const toInsert = added.map((image_url, offset) => {
    const index = keptRows.length + offset
    return { image_url, display_order: index, is_thumbnail: index === 0 }
  })

  return { toDeleteIds, toInsert, toUpdate }
}
