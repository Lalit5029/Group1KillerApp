"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  formatGradeForPresentation,
  formatGpaForPresentation,
  privacySanitizeAdvisorAlert,
  PRESENTATION_PRIVACY_STORAGE_KEY,
} from "@/lib/presentation-privacy"
import type { AdvisorAlert } from "@/lib/graduation-readiness"

type PresentationPrivacyContextValue = {
  hideSensitiveAcademic: boolean
  setHideSensitiveAcademic: (value: boolean) => void
  formatGrade: (grade?: string | null) => string
  formatGpa: (gpa?: string | null) => string
  sanitizeAdvisorAlert: (alert: AdvisorAlert) => AdvisorAlert
}

const PresentationPrivacyContext = createContext<PresentationPrivacyContextValue | null>(null)

export function PresentationPrivacyProvider({ children }: { children: ReactNode }) {
  const [hideSensitiveAcademic, setHideState] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem(PRESENTATION_PRIVACY_STORAGE_KEY)
      setHideState(v === "1" || v === "true")
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  const setHideSensitiveAcademic = useCallback((value: boolean) => {
    setHideState(value)
    try {
      if (value) localStorage.setItem(PRESENTATION_PRIVACY_STORAGE_KEY, "1")
      else localStorage.removeItem(PRESENTATION_PRIVACY_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo<PresentationPrivacyContextValue>(() => {
    const hide = hydrated && hideSensitiveAcademic
    return {
      hideSensitiveAcademic: hide,
      setHideSensitiveAcademic,
      formatGrade: (grade) => formatGradeForPresentation(grade, hide),
      formatGpa: (gpa) => formatGpaForPresentation(gpa, hide),
      sanitizeAdvisorAlert: (alert) => privacySanitizeAdvisorAlert(alert, hide),
    }
  }, [hydrated, hideSensitiveAcademic, setHideSensitiveAcademic])

  return (
    <PresentationPrivacyContext.Provider value={value}>{children}</PresentationPrivacyContext.Provider>
  )
}

export function usePresentationPrivacy(): PresentationPrivacyContextValue {
  const ctx = useContext(PresentationPrivacyContext)
  if (!ctx) {
    throw new Error("usePresentationPrivacy must be used within PresentationPrivacyProvider")
  }
  return ctx
}
