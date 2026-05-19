import type { Quote } from "@/config/quotes";

interface AuthImagePanelProps {
  quote: Quote;
}

export function AuthImagePanel({ quote }: AuthImagePanelProps) {
  return (
    <div className="relative hidden lg:flex flex-col justify-center p-10 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 bg-muted">
      <div className="flex flex-col justify-center flex-1 items-center">
        <blockquote className="w-full max-w-[32rem] text-slate-900 dark:text-white">
          <p className="text-2xl lg:text-[2rem] font-semibold leading-tight mb-6">
            {quote.text}
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-700 dark:text-slate-300">—</span>
            <span className="text-slate-700 dark:text-slate-300">
              {quote.author}
            </span>
          </div>
        </blockquote>
      </div>
    </div>
  );
}
