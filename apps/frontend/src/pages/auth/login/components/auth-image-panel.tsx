import { Link } from '@tanstack/react-router'
import { BrandIcon } from '@/config/navigation'

interface AuthImagePanelProps {
  quote: string
}

export function AuthImagePanel({ quote }: AuthImagePanelProps) {
  return (
    <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10">
      <Link to={'/' as never} className="flex items-center gap-2 text-white">
        <BrandIcon className="size-5" />
        <span className="font-semibold text-lg">BizNest</span>
      </Link>
      <blockquote className="text-white">
        <p className="text-lg leading-relaxed">{quote}</p>
      </blockquote>
    </div>
  )
}
