import { Map } from '@/components/map'
import { HazardControls } from './components/hazard-controls'
import { ZoneEditPopup } from './components/zone-edit-popup'

export function MapPage() {
  return (
    <Map className="size-full">
      <HazardControls />
      <ZoneEditPopup />
    </Map>
  )
}