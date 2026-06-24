'use client'

import { useEffect, useRef } from 'react'

interface Props {
  onLocationChange: (lat: number, lng: number) => void
  initialLat?: number | null
  initialLng?: number | null
}

export default function PublishMap({ onLocationChange, initialLat, initialLng }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)
  const markerRef = useRef<import('leaflet').Marker | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then(L => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const center: [number, number] = initialLat && initialLng
        ? [initialLat, initialLng]
        : [6.3702, 2.3912]

      const map = L.map(mapRef.current!).setView(center, initialLat ? 16 : 13)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      function placeMarker(lat: number, lng: number) {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map)
          markerRef.current.on('dragend', (e) => {
            const pos = (e.target as import('leaflet').Marker).getLatLng()
            onLocationChange(pos.lat, pos.lng)
          })
        }
        onLocationChange(lat, lng)
      }

      if (initialLat && initialLng) {
        placeMarker(initialLat, initialLng)
      }

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        placeMarker(e.latlng.lat, e.latlng.lng)
      })
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div ref={mapRef} style={{ height: 220, width: '100%', borderRadius: 8, zIndex: 0 }} />
      <p style={{ fontSize: '0.75rem', color: 'var(--ink-light)', marginTop: 6 }}>
        Cliquez sur la carte ou faites glisser le marqueur pour préciser la localisation
      </p>
    </div>
  )
}
