import { createFileRoute } from '@tanstack/react-router'
import { ZoningDrawPage } from '@/pages/zoning-draw/zoning-draw.page'

export const Route = createFileRoute('/_protected/zoning-draw/')({
  component: ZoningDrawPage,
})
