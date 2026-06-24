'use client'

import { useEffect, useRef } from 'react'

interface Props {
  lat: number
  lng: number
  titre: string
}

export default function ListingMiniMap({ lat, lng, titre }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    if ((mapRef.current as any)._leaflet_id) {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
      delete (mapRef.current as any)._leaflet_id
    }

    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    import('leaflet').then(L => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })
      const map = L.map(mapRef.current!, { zoomControl: false, dragging: false }).setView([lat, lng], 15)
      mapInstanceRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      L.marker([lat, lng]).addTo(map).bindPopup(titre).openPopup()
    })

    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [lat, lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mapRef} style={{ height: 150, width: '100%', borderRadius: 8, overflow: 'hidden', position: 'relative', zIndex: 0 }} />
}
