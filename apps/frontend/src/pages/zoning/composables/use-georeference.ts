import {useState, useCallback, useRef, useEffect} from 'react'
import { useMapContext } from '@/context/map.context'
import type { ImageCorners } from '@/engine/map.engine'

const OVERLAY_ID = 'zoning-georeference'

function centroid(c: ImageCorners): [number, number] {
  return [c.reduce((s, p) => s + p[0], 0) / 4, c.reduce((s, p) => s + p[1], 0) / 4]
}

function rotateCorners(corners: ImageCorners, deltaDeg: number): ImageCorners {
  const [cx, cy] = centroid(corners)
  const rad = (deltaDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return corners.map(([lng, lat]) => {
    const dx = lng - cx
    const dy = lat - cy
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
  }) as ImageCorners
}

export interface GeoreferenceState {
  imageUrl: string | null
  imageName: string | null
  corners: ImageCorners | null
  opacity: number
  rotation: number
  saved: boolean
}

export function useGeoreference() {
  const { engine } = useMapContext()
  const engineRef = useRef(engine)

  useEffect(() => {
    engineRef.current = engine
  }, [engine]);


  const [state, setState] = useState<GeoreferenceState>({
    imageUrl: null, imageName: null, corners: null,
    opacity: 0.75, rotation: 0, saved: false,
  })

  const loadImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    const eng = engineRef.current
    if (!eng) return

    const img = new window.Image()
    img.onload = () => {
      const bounds = eng.instance.getBounds()
      const spanLng = (bounds.getEast() - bounds.getWest()) * 0.30
      const spanLat = spanLng * (img.naturalHeight / img.naturalWidth)
      const { lng, lat } = eng.instance.getCenter()
      const hw = spanLng / 2
      const hh = spanLat / 2
      const corners: ImageCorners = [
        [lng - hw, lat + hh],
        [lng + hw, lat + hh],
        [lng + hw, lat - hh],
        [lng - hw, lat - hh],
      ]
      setState(prev => {
        if (prev.imageUrl) URL.revokeObjectURL(prev.imageUrl)
        return { imageUrl: url, imageName: file.name, corners, opacity: prev.opacity, rotation: 0, saved: false }
      })
      eng.addImageOverlay(OVERLAY_ID, url, corners)
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }, [])

  const updateCorner = useCallback((index: number, lngLat: [number, number]) => {
    setState(prev => {
      if (!prev.corners) return prev
      const next = prev.corners.slice() as ImageCorners
      next[index] = lngLat
      engineRef.current?.updateImageOverlay(OVERLAY_ID, next)
      // reset rotation so the slider starts from new position
      return { ...prev, corners: next, rotation: 0, saved: false }
    })
  }, [])

  const applyRotation = useCallback((deg: number) => {
    setState(prev => {
      if (!prev.corners) return prev
      const delta = deg - prev.rotation
      if (Math.abs(delta) < 0.001) return prev
      const next = rotateCorners(prev.corners, delta)
      engineRef.current?.updateImageOverlay(OVERLAY_ID, next)
      return { ...prev, corners: next, rotation: deg, saved: false }
    })
  }, [])

  const updateOpacity = useCallback((opacity: number) => {
    setState(prev => ({ ...prev, opacity }))
    engineRef.current?.setImageOverlayOpacity(OVERLAY_ID, opacity)
  }, [])

  const saveAlignment = useCallback(() => {
    setState(prev => {
      if (!prev.corners) return prev
      const record = {
        imageName: prev.imageName,
        savedAt: new Date().toISOString(),
        corners: {
          topLeft:     { lng: prev.corners[0][0], lat: prev.corners[0][1] },
          topRight:    { lng: prev.corners[1][0], lat: prev.corners[1][1] },
          bottomRight: { lng: prev.corners[2][0], lat: prev.corners[2][1] },
          bottomLeft:  { lng: prev.corners[3][0], lat: prev.corners[3][1] },
        },
      }
      try { localStorage.setItem(`biznest:georeference:${Date.now()}`, JSON.stringify(record)) } catch { /* full */ }
      return { ...prev, saved: true }
    })
  }, [])

  const clearOverlay = useCallback(() => {
    setState(prev => {
      if (prev.imageUrl) URL.revokeObjectURL(prev.imageUrl)
      return { imageUrl: null, imageName: null, corners: null, opacity: 0.75, rotation: 0, saved: false }
    })
    engineRef.current?.removeImageOverlay(OVERLAY_ID)
  }, [])

  return { ...state, loadImage, updateCorner, applyRotation, updateOpacity, saveAlignment, clearOverlay }
}