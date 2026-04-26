import { Map } from '@/components/map'
import { HazardControls } from './components/hazard-controls'

export function MapPage() {
  return (
    <Map className="size-full">
      <HazardControls />
    </Map>
  )
}