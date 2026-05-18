import { createFileRoute } from '@tanstack/react-router'
import { HazardPage } from '@/pages/hazard/hazard.page'

export const Route = createFileRoute('/_protected/hazard/')({
  component: HazardPage,
})
