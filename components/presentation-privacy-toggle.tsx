"use client"

import { Eye, EyeOff } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { usePresentationPrivacy } from "@/components/presentation-privacy-provider"
import { cn } from "@/lib/utils"

export function PresentationPrivacyToggle({ className }: { className?: string }) {
  const { hideSensitiveAcademic, setHideSensitiveAcademic } = usePresentationPrivacy()

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-2 py-1.5 sm:px-3",
        className,
      )}
      title="Hide letter grades and GPA on screen for public demos"
    >
      {hideSensitiveAcademic ? (
        <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <Eye className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <Label htmlFor="presentation-privacy" className="hidden cursor-pointer text-xs sm:inline">
        Hide grades
      </Label>
      <Switch
        id="presentation-privacy"
        checked={hideSensitiveAcademic}
        onCheckedChange={setHideSensitiveAcademic}
        className="scale-90"
        aria-label="Hide grades and GPA for presentation"
      />
    </div>
  )
}
