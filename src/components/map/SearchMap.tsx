'use client'

import { useEffect, useRef } from 'react'
import type { Logement } from '@/types/database'

interface Props {
  logements: Logement[]
  onMarkerClick: (id: string) => void
}

export default function SearchMap({ logements, onMarkerClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    if ((mapRef.current as any)._leaflet_id) {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
      delete (mapRef.current as any)._leaflet_id
    }

    let map: import('leaflet').Map

    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    import('leaflet').then(L => {
      // Corriger les icônes par défaut Leaflet (cassées avec bundlers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      map = L.map(mapRef.current!).setView([6.3702, 2.3912], 13)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      logements.forEach(l => {
        if (!l.latitude || !l.longitude) return

        const icon = L.divIcon({
          className: '',
          html: `<div class="map-marker">${Math.round(l.loyer_mensuel / 1000)}k</div>`,
          iconSize: [60, 28],
          iconAnchor: [30, 28],
        })

        L.marker([l.latitude, l.longitude], { icon })
          .addTo(map)
          .bindTooltip(`${l.titre} — ${l.loyer_mensuel?.toLocaleString('fr-FR')} FCFA`, { direction: 'top' })
          .on('click', () => onMarkerClick(l.id))
      })

      // Ajuster la vue si des logements avec coords
      const withCoords = logements.filter(l => l.latitude && l.longitude)
      if (withCoords.length > 0) {
        const bounds = L.latLngBounds(withCoords.map(l => [l.latitude!, l.longitude!]))
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={mapRef} style={{ height: 'calc(100vh - 180px)', width: '100%', minHeight: 400, overflow: 'hidden', position: 'relative', zIndex: 0 }} />
  )
}
