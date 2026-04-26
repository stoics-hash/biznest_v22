import { createFileRoute } from '@tanstack/react-router'
import {ZoningPage} from "@/pages/zoning/zoning.tsx";

export const Route = createFileRoute('/_protected/zoning/')({
  component: ZoningPage,
})

