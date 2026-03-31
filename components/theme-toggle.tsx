"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark")

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "h-10 w-10 shrink-0 border-border bg-background/80 backdrop-blur-sm",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-[1.15rem] w-[1.15rem]" />
        ) : (
          <Moon className="h-[1.15rem] w-[1.15rem]" />
        )
      ) : (
        <span className="h-[1.15rem] w-[1.15rem]" aria-hidden />
      )}
    </Button>
  )
}
