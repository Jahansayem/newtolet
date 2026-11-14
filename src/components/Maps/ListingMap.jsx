'use client'

import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * OpenStreetMap + Leaflet, loaded only in the browser and only on pages that show a map.
 *
 * points: [{ id, lat, lng, precision: 'exact'|'area'|'district', label, href }]
 * Exact points get a dot; approximate ones a translucent circle sized to their precision, so the
 * map never pretends to know an address it does not have.
 */
const RADIUS_BY_PRECISION = { exact: 0, area: 1200, district: 9000 }

// Popup content is HTML; listing text comes from users, so escape it.
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

const ListingMap = ({ points = [], height = 320, className = '', ariaLabel = 'Map', onBoundsSearch = null, boundsLabel = '' }) => {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const pointsKey = JSON.stringify(points.map((point) => [point.id, point.lat, point.lng, point.precision]))

  useEffect(() => {
    let cancelled = false

    import('leaflet').then((module) => {
      const L = module.default || module
      if (cancelled || !containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, { scrollWheelZoom: false, attributionControl: true })
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map)
      layerRef.current = L.layerGroup().addTo(map)
      mapRef.current = { map, L }
      setReady(true)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.map.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    const { map, L } = mapRef.current
    const layer = layerRef.current
    layer.clearLayers()

    const bounds = []
    points.forEach((point) => {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return
      const radius = RADIUS_BY_PRECISION[point.precision] || 0
      const shape = radius
        ? L.circle([point.lat, point.lng], { radius, color: '#1f6fb2', weight: 1, fillOpacity: 0.15 })
        : L.circleMarker([point.lat, point.lng], { radius: 8, color: '#ffffff', weight: 2, fillColor: '#1f6fb2', fillOpacity: 1 })
      if (point.label) {
        const label = escapeHtml(point.label)
        const link = point.href ? `<a href="${escapeHtml(point.href)}">${label}</a>` : label
        shape.bindPopup(link)
      }
      shape.addTo(layer)
      bounds.push([point.lat, point.lng])
      if (radius) {
        const latDelta = radius / 111000
        bounds.push([point.lat + latDelta, point.lng], [point.lat - latDelta, point.lng])
      }
    })

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
    } else {
      map.setView([23.685, 90.3563], 7)
    }
    // pointsKey captures the point list; `points` itself is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pointsKey])

  const handleBoundsSearch = () => {
    if (!mapRef.current || !onBoundsSearch) return
    const bounds = mapRef.current.map.getBounds()
    onBoundsSearch({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
  }

  return (
    <div className={`relative overflow-hidden rounded-[var(--radius-panel)] border border-line ${className}`}>
      <div ref={containerRef} style={{ height }} role='region' aria-label={ariaLabel} className='z-0 bg-canvas' />
      {onBoundsSearch && ready ? (
        <button
          type='button'
          onClick={handleBoundsSearch}
          className='ui-btn ui-btn-primary ui-btn-sm absolute left-1/2 top-3 z-[400] -translate-x-1/2 shadow-overlay'
        >
          {boundsLabel}
        </button>
      ) : null}
    </div>
  )
}

export default ListingMap
