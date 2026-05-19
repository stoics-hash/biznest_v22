import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@/config/navigation";

import type { Quote } from "@/config/quotes";

interface AuthImagePanelProps {
  quote: Quote;
}

export function AuthImagePanel({ quote }: AuthImagePanelProps) {
  return (
    <div className="relative hidden lg:flex flex-col justify-between p-10 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 bg-white">
      <Link
        to={"/" as never}
        className="flex items-center gap-2 text-slate-900 dark:text-white"
      >
        <BrandIcon className="size-5" />
        <span className="font-semibold text-lg">BizNest</span>
      </Link>

      <div className="mt-8">
        <blockquote className="text-slate-900 dark:text-white">
          <p className="text-2xl lg:text-4xl font-semibold leading-tight">
            {quote.text}
          </p>
        </blockquote>

        <div className="mt-8 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-700 dark:text-slate-200">
            {quote.author
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="text-slate-700 dark:text-slate-300 text-sm">
            {quote.author}
          </div>
        </div>
      </div>
    </div>
  );
}
