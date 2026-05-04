import { createFileRoute } from '@tanstack/react-router'
import {ZoningMapPage} from "@/pages/zoning/zoning.map.tsx";

export const Route = createFileRoute('/_protected/zoning/zoning-map')({
  component: ZoningMapPage,
})
