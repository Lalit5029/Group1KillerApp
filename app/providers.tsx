"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="course-planner-theme" disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
} 