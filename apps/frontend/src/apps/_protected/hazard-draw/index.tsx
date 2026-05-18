import { createFileRoute } from '@tanstack/react-router'
import { HazardDrawPage } from '@/pages/hazard-draw/hazard-draw.page'

export const Route = createFileRoute('/_protected/hazard-draw/')({
  component: HazardDrawPage,
})
