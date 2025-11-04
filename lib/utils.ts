import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Parse time string to minutes
export function parseTimeToMinutes(timeString?: string): number {
  if (!timeString || typeof timeString !== "string") return Number.NaN

  const timeRegex = /(\d{1,2}):(\d{2})\s*([AP]M)/i
  const match = timeString.match(timeRegex)

  if (!match) return Number.NaN

  let hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  const ampm = match[3]

  if (typeof ampm !== "string" || isNaN(hour) || isNaN(minute) || hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return Number.NaN
  }

  const isPM = ampm.toUpperCase() === "PM"
  if (isPM && hour !== 12) hour += 12
  else if (!isPM && hour === 12) hour = 0

  return hour * 60 + minute
}

// Get department code from class name
export function getDepartmentCode(className?: string): string {
  if (!className) return ""

  const match = className.match(/^([A-Za-z]+)/)
  return match ? match[1] : ""
}
