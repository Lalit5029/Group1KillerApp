"use client"

import { useCallback, useRef, useState } from "react"
import { Clipboard, MessageCircle, Send, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { SelectedCourse } from "@/lib/types"
import { cn } from "@/lib/utils"

type ChatRole = "user" | "assistant"

type ChatMessage = {
  role: ChatRole
  content: string
  scheduleSuggestion?: SelectedCourse[]
  isIssue?: boolean
}

type ScheduleAssistantChatProps = {
  onApplySchedule: (sections: SelectedCourse[]) => void
}

export function ScheduleAssistantChat({ onApplySchedule }: ScheduleAssistantChatProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask how to use the planner, look up a course (“Where is CIS 375?”), check a term (“Can CIS 375 be taken Fall 2026?”), or describe a schedule (“CIS 251, CIS 375, …—no Fridays, nothing after 6 PM”). I use the catalog; confirm details in MySlice.",
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)

  const isIssueMessage = (text: string) =>
    /\bunavailable\b|\berror\b|\bfailed\b|\bcould not\b|\bmissing\b/i.test(text)

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput("")
    const nextHistory = [...messages, { role: "user" as const, content: text }]
    setMessages(nextHistory)
    setLoading(true)
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              typeof data.message === "string"
                ? data.message
                : "Something went wrong. Check that you are signed in and try again.",
          },
        ])
        return
      }
      const reply = String(data.reply || "")
      const scheduleSuggestion = Array.isArray(data.scheduleSuggestion)
        ? (data.scheduleSuggestion as SelectedCourse[])
        : undefined
      if (typeof data.llmAvailable === "boolean") {
        setLlmAvailable(data.llmAvailable)
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, scheduleSuggestion, isIssue: isIssueMessage(reply) },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error. Try again in a moment.",
          isIssue: true,
        },
      ])
    } finally {
      setLoading(false)
      requestAnimationFrame(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      })
    }
  }, [input, loading, messages])

  return (
    <>
      <Button
        type="button"
        size="icon"
        className={cn(
          "fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full shadow-lg sm:bottom-6 sm:right-6 sm:h-14 sm:w-14",
          "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        onClick={() => setOpen(true)}
        aria-label="Open schedule assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b px-6 py-4 text-left">
            <SheetTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Schedule assistant
              </span>
              {llmAvailable === false && (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Catalog mode only
                </span>
              )}
            </SheetTitle>
            <SheetDescription>
              Catalog-backed scheduling plus optional AI for general questions (set{" "}
              <code className="text-xs">GEMINI_API_KEY</code> or{" "}
              <code className="text-xs">HUGGINGFACE_API_KEY</code> on the server).
            </SheetDescription>
            <p className="text-xs text-muted-foreground">
              Best results: include course codes and constraints (e.g. <code>CIS 375, no Friday, end by 6 PM</code>).
            </p>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-4 py-3">
            <div className="flex flex-col gap-3 pb-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    m.role === "user"
                      ? "ml-6 bg-primary text-primary-foreground"
                      : m.isIssue
                        ? "mr-4 border border-amber-300 bg-amber-50"
                        : "mr-4 bg-muted",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === "assistant" && m.isIssue && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(m.content)
                        } catch {
                          // no-op in unsupported clipboard contexts
                        }
                      }}
                    >
                      <Clipboard className="mr-1 h-4 w-4" />
                      Copy issue details
                    </Button>
                  )}
                  {m.role === "assistant" &&
                    m.scheduleSuggestion &&
                    m.scheduleSuggestion.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 w-full"
                        variant="secondary"
                        onClick={() => onApplySchedule(m.scheduleSuggestion!)}
                      >
                        Add to schedule
                      </Button>
                    )}
                </div>
              ))}
              {loading && (
                <div className="mr-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-4 space-y-2">
            <Textarea
              placeholder="e.g. CIS 375 and MAT 331, no Friday, end by 6 PM"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                <X className="mr-1 h-4 w-4" />
                Close
              </Button>
              <Button type="button" size="sm" onClick={() => void send()} disabled={loading}>
                <Send className="mr-1 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
