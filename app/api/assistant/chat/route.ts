import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { requireAdvisorSession } from "@/lib/server-auth"
import { answerCatalogLookup, isCatalogLookupQuestion } from "@/lib/assistant-catalog-lookup"
import {
  parseScheduleConstraintsFromText,
  solveSchedule,
  shouldAttemptScheduleSolve,
} from "@/lib/assistant-schedule-engine"
import { generateGeminiAssistantReply, getGeminiApiKey } from "@/lib/assistant-gemini"
import { matchHelpAnswer, ASSISTANT_SYSTEM_PRIMER } from "@/lib/assistant-help"
import type { Course, SelectedCourse } from "@/lib/types"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    await requireAdvisorSession()
    const body = await req.json()
    const message = String(body.message || "").trim()
    if (!message) {
      return NextResponse.json({ message: "Message is required" }, { status: 400 })
    }

    const catalogPath = path.join(process.cwd(), "public", "data", "courses.json")
    const raw = await fs.readFile(catalogPath, "utf8")
    const catalog = JSON.parse(raw) as Course[]

    const constraints = parseScheduleConstraintsFromText(message)
    let reply = ""
    let scheduleSuggestion: SelectedCourse[] | undefined

    if (isCatalogLookupQuestion(message)) {
      reply = answerCatalogLookup(catalog, message)
    } else if (shouldAttemptScheduleSolve(message)) {
      const result = solveSchedule(catalog, constraints)
      scheduleSuggestion = result.ok ? result.selection : undefined

      const summaryBits: string[] = []
      if (constraints.avoidFriday) summaryBits.push("no Friday classes")
      if (constraints.maxEndMinutes != null) summaryBits.push("all classes end by 6:00 PM")
      const filterLine =
        summaryBits.length > 0 ? `Constraints applied: ${summaryBits.join(", ")}.\n\n` : ""

      if (result.ok && result.selection.length > 0) {
        const lines = result.selection.map(
          (s) =>
            `• **${s.Class}** ${s.Section || ""} — ${s.DaysTimes || "TBA"}${s.Room ? ` — ${s.Room}` : ""}`,
        )
        reply =
          filterLine +
          `Here is one conflict-free combination from the catalog:\n${lines.join("\n")}\n\nUse **Add to schedule** to copy these sections into the planner.`
      } else {
        reply = filterLine + result.issues.join("\n\n")
      }
    } else {
      const help = matchHelpAnswer(message)
      if (help) {
        reply = help
      } else {
        const history = Array.isArray(body.history) ? body.history.slice(-8) : []
        const historyForLlm = history.map((h: { role?: string; content?: string }) => ({
          role: h.role === "assistant" ? "assistant" : "user",
          content: String(h.content || ""),
        }))

        if (getGeminiApiKey()) {
          const out = await generateGeminiAssistantReply(
            ASSISTANT_SYSTEM_PRIMER,
            historyForLlm,
            message,
          )
          if ("text" in out) {
            reply = out.text
          } else {
            reply = `Gemini is unavailable (${out.error}). You can still use **catalog lookups**, **term checks**, and **schedule building**, or set **HUGGINGFACE_API_KEY** as a fallback.`
          }
        } else {
          const token = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
          if (token) {
            const { InferenceClient } = await import("@huggingface/inference")
            const client = new InferenceClient(token)
            const model =
              process.env.HUGGINGFACE_ASSISTANT_MODEL || "meta-llama/Llama-3.2-3B-Instruct"
            const messages = [
              { role: "system" as const, content: ASSISTANT_SYSTEM_PRIMER },
              ...historyForLlm.map((h) => ({
                role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
                content: h.content,
              })),
              { role: "user" as const, content: message },
            ]
            try {
              const hfOut = await client.chatCompletion({
                model,
                messages,
                max_tokens: 512,
              })
              const text = hfOut.choices?.[0]?.message?.content
              reply =
                typeof text === "string" && text.trim()
                  ? text.trim()
                  : "I could not read the model response. Try again or rephrase."
            } catch (e) {
              reply = `The AI model is unavailable (${e instanceof Error ? e.message : "error"}). You can still ask me to **schedule specific courses** with rules (e.g. no Fridays, end by 6 PM).`
            }
          } else {
            reply =
              "I can **look up rooms, times, instructors**, check **whether a course appears for a term** using catalog meeting dates (e.g. “Can CIS 375 be taken Fall 2026?”), **build schedules** with rules (no Fridays, end by 6 PM), and answer **imports / conflicts / tabs**. For other open-ended questions, set **GEMINI_API_KEY** (Google AI Studio) or **HUGGINGFACE_API_KEY** / **HF_TOKEN** on the server."
          }
        }
      }
    }

    return NextResponse.json({ reply, scheduleSuggestion })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg === "Unauthorized") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    console.error(e)
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}
