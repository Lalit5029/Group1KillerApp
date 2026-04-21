"use client"

import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { PresentationPrivacyToggle } from "@/components/presentation-privacy-toggle"
import { cn } from "@/lib/utils"

interface SiteHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
  className?: string
}

export function SiteHeader({ title, subtitle, children, className }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/80 bg-card/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/75",
        className
      )}
    >
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/students"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary font-serif text-lg font-black text-primary-foreground shadow-md ring-1 ring-primary/20 transition-all hover:bg-primary/95 hover:shadow-[0_0_16px_4px_hsl(24_100%_48%/0.45)]"
            aria-label="Syracuse Course Planner home"
          >
            SU
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {children}
          <PresentationPrivacyToggle className="transition-all hover:shadow-[0_0_16px_4px_hsl(24_100%_48%/0.45)] rounded-lg" />
          <ThemeToggle className="transition-all hover:shadow-[0_0_16px_4px_hsl(24_100%_48%/0.45)] rounded-lg" />
        </div>
      </div>
    </header>
  )
}