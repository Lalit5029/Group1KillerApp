"use client"

import { useEffect, useMemo, useState } from "react"

const ZOOM_STORAGE_KEY = "ui-zoom-percent"
const CONTRAST_STORAGE_KEY = "ui-high-contrast"
const MIN_ZOOM = 90
const MAX_ZOOM = 140
const STEP = 10

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

export function LowVisionZoomControls() {
  const [zoomPercent, setZoomPercent] = useState(100)
  const [highContrastEnabled, setHighContrastEnabled] = useState(false)

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY))
    const initial = Number.isFinite(saved) && saved > 0 ? clampZoom(saved) : 100
    setZoomPercent(initial)
    setHighContrastEnabled(window.localStorage.getItem(CONTRAST_STORAGE_KEY) === "true")
  }, [])

  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomPercent}%`
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomPercent))
  }, [zoomPercent])

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", highContrastEnabled)
    window.localStorage.setItem(CONTRAST_STORAGE_KEY, String(highContrastEnabled))
  }, [highContrastEnabled])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return

      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        setZoomPercent((current) => clampZoom(current + STEP))
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault()
        setZoomPercent((current) => clampZoom(current - STEP))
      } else if (event.key === "0") {
        event.preventDefault()
        setZoomPercent(100)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const zoomLabel = useMemo(() => `${zoomPercent}%`, [zoomPercent])

  return (
    <div className="fixed bottom-4 right-4 z-[70] rounded-lg border bg-card/95 p-2 shadow-lg backdrop-blur">
      <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">Low-vision zoom</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
          onClick={() => setZoomPercent((current) => clampZoom(current - STEP))}
          aria-label="Zoom out"
        >
          A-
        </button>
        <span className="min-w-12 text-center text-sm font-semibold">{zoomLabel}</span>
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
          onClick={() => setZoomPercent((current) => clampZoom(current + STEP))}
          aria-label="Zoom in"
        >
          A+
        </button>
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
          onClick={() => setZoomPercent(100)}
          aria-label="Reset zoom"
        >
          Reset
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <span className="text-xs text-muted-foreground">High contrast</span>
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
          aria-pressed={highContrastEnabled}
          onClick={() => setHighContrastEnabled((current) => !current)}
        >
          {highContrastEnabled ? "On" : "Off"}
        </button>
      </div>
      <p className="mt-2 px-1 text-[11px] text-muted-foreground">Shortcuts: Ctrl/Cmd +, -, 0</p>
    </div>
  )
}
"use client"

import { useEffect, useMemo, useState } from "react"

const ZOOM_STORAGE_KEY = "ui-zoom-percent"
const CONTRAST_STORAGE_KEY = "ui-high-contrast"
const MIN_ZOOM = 90
const MAX_ZOOM = 140
const STEP = 10

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

export function LowVisionZoomControls() {
  const [zoomPercent, setZoomPercent] = useState(100)
  const [highContrastEnabled, setHighContrastEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY))
    const initial = Number.isFinite(saved) && saved > 0 ? clampZoom(saved) : 100
    setZoomPercent(initial)
    setHighContrastEnabled(window.localStorage.getItem(CONTRAST_STORAGE_KEY) === "true")
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.style.fontSize = `${zoomPercent}%`
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomPercent))
  }, [zoomPercent])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.classList.toggle("high-contrast", highContrastEnabled)
    window.localStorage.setItem(CONTRAST_STORAGE_KEY, String(highContrastEnabled))
  }, [highContrastEnabled])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.altKey) return

      const key = event.key
      if (key === "+" || key === "=") {
        event.preventDefault()
        setZoomPercent((current) => clampZoom(current + STEP))
      } else if (key === "-" || key === "_") {
        event.preventDefault()
        setZoomPercent((current) => clampZoom(current - STEP))
      } else if (key === "0") {
        event.preventDefault()
        setZoomPercent(100)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const zoomLabel = useMemo(() => `${zoomPercent}%`, [zoomPercent])

  return (
    <div className="fixed bottom-4 right-4 z-[70] rounded-lg border bg-card/95 p-2 shadow-lg backdrop-blur">
      <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">Low-vision zoom</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
          onClick={() => setZoomPercent((current) => clampZoom(current - STEP))}
          aria-label="Zoom out"
        >
          A-
        </button>
        <span className="min-w-12 text-center text-sm font-semibold">{zoomLabel}</span>
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
          onClick={() => setZoomPercent((current) => clampZoom(current + STEP))}
          aria-label="Zoom in"
        >
          A+
        </button>
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
          onClick={() => setZoomPercent(100)}
          aria-label="Reset zoom"
        >
          Reset
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <span className="text-xs text-muted-foreground">High contrast</span>
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
          aria-pressed={highContrastEnabled}
          onClick={() => setHighContrastEnabled((current) => !current)}
        >
          {highContrastEnabled ? "On" : "Off"}
        </button>
      </div>
      <p className="mt-2 px-1 text-[11px] text-muted-foreground">Shortcuts: Ctrl/Cmd +, -, 0</p>
    </div>
  )
}
