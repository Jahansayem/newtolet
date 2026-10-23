export const HOME_CHROME_SCROLL_EVENT = 'home-chrome-scroll'
export const OPEN_SEARCH_OVERLAY_EVENT = 'open-search-overlay'

const DEFAULT_NAV_HEIGHT = 65

/**
 * Rendered header height in px. Reads the --nav-h custom property that src/index.css keeps in
 * sync with the <header> markup, so JS scroll maths and CSS sticky offsets never drift apart.
 */
export const getNavHeight = () => {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
    return DEFAULT_NAV_HEIGHT
  }

  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'))
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_NAV_HEIGHT
}
