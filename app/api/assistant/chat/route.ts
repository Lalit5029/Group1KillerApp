import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import prisma from "@/lib/prisma"
import { getAuthorizedStudent, requireAdvisorSession } from "@/lib/server-auth"
import { answerCatalogLookup, isCatalogLookupQuestion } from "@/lib/assistant-catalog-lookup"
import {
  extractCourseCodesFromText,
  parseScheduleConstraintsFromText,
  solveSchedule,
  shouldAttemptScheduleSolve,
} from "@/lib/assistant-schedule-engine"
import { generateGeminiAssistantReply, getGeminiApiKey } from "@/lib/assistant-gemini"
import { matchHelpAnswer, ASSISTANT_SYSTEM_PRIMER } from "@/lib/assistant-help"
import { COURSE_DEPENDENCY_CATALOG } from "@/lib/recommendation/course-dependency-catalog"
import { buildRecommendationPayload } from "@/lib/recommendation/build-recommendation-payload"
import { runFallbackReasoner } from "@/lib/recommendation/fallback-reasoner"
import { rankRecommendations } from "@/lib/recommendation/rank-recommendations"
import type { CatalogSectionRecord, RequirementBlockRecord } from "@/lib/recommendation/types"
import type { Course, SelectedCourse } from "@/lib/types"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const session = await requireAdvisorSession()
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
    let assistantMode: "catalog" | "schedule" | "help" | "llm" | "fallback" = "fallback"
    const llmAvailable = Boolean(getGeminiApiKey() || process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN)
    const codesInMessage = extractCourseCodesFromText(message)
    const prereqQuestion =
      codesInMessage.length > 0 &&
      /\b(prereq|prerequisite|pre-req|requirements?\s+for|needed\s+for|require\s+for)\b/i.test(message)
    const recommendationIntent =
      /\b(recommend|suggest|next\s+course|next\s+courses|what\s+should\s+i\s+take)\b/i.test(message) &&
      /\b(completed|already\s+took|already\s+completed|finished|passed|done)\b/i.test(message)

    if (isCatalogLookupQuestion(message)) {
      assistantMode = "catalog"
      reply = answerCatalogLookup(catalog, message)
    } else if (prereqQuestion) {
      assistantMode = "catalog"
      const lines: string[] = []
      for (const code of codesInMessage) {
        const def = COURSE_DEPENDENCY_CATALOG[code]
        if (!def?.prerequisites || def.prerequisites.length === 0) {
          lines.push(`• **${code}** — no prerequisite rule is currently defined in this app.`)
          continue
        }
        const formatted = def.prerequisites
          .map((g) => (g.type === "oneOf" ? g.courses.join(" or ") : g.courses.join(" and ")))
          .join(" and ")
        lines.push(`• **${code}** — ${formatted}`)
      }
      reply = `From the app's curated prerequisite map:\n${lines.join("\n")}`
    } else if (recommendationIntent) {
      const studentId = String(body.studentId || "")
      const selectedMajor = String(body.selectedMajor || "").trim()
      const selectedYear = String(body.selectedYear || "").trim()
      const requirementsForMajor = body.requirementsForMajor || {}
      const catalogCourses = Array.isArray(body.catalogCourses)
        ? (body.catalogCourses as CatalogSectionRecord[])
        : []
      if (!studentId) {
        assistantMode = "fallback"
        reply = "Please select a student first so I can generate personalized recommendations."
      } else {
        const student = await getAuthorizedStudent(studentId, session.user.id)
        const [academicCourses, degreeRequirements] = await Promise.all([
          prisma.academicCourse.findMany({
            where: { studentId: student.id },
            orderBy: { createdAt: "asc" },
          }),
          prisma.degreeRequirement.findMany({
            where: { studentId: student.id },
            orderBy: { createdAt: "asc" },
          }),
        ])
        const payload = buildRecommendationPayload({
          studentId: student.id,
          studentName: student.name,
          selectedMajor: selectedMajor || student.major || "",
          selectedYear: selectedYear || student.academicYear || "",
          term: "Current Catalog",
          requirementsForMajor,
          academicCourses,
          degreeRequirements: degreeRequirements.map((block) => ({
            title: block.title,
            status: block.status,
            courses: Array.isArray(block.courses)
              ? (block.courses as unknown as RequirementBlockRecord["courses"])
              : [],
          })),
          catalogCourses,
        })
        const inferredResults = runFallbackReasoner(payload)
        const engine = "deterministic"
        const ranked = rankRecommendations(payload.candidateCourses, inferredResults)
        const candidateByCode = new Map(payload.candidateCourses.map((c) => [c.courseCode, c]))
        const formatMissingFromGroups = (
          groups: Array<{ type: "allOf" | "oneOf"; courses: string[] }>,
          missing: string[],
        ) => {
          const missingSet = new Set(missing)
          const unmetGroups = groups.filter((g) =>
            g.type === "oneOf"
              ? g.courses.every((c) => missingSet.has(c))
              : g.courses.some((c) => missingSet.has(c)),
          )
          if (unmetGroups.length === 0) return ""
          return unmetGroups
            .map((g) => (g.type === "oneOf" ? g.courses.join(" or ") : g.courses.join(" and ")))
            .join(" and ")
        }
        const recommended = ranked.filter((r) => !r.blocked).slice(0, 6)
        const blocked = ranked.filter((r) => r.blocked).slice(0, 3)
        if (recommended.length === 0) {
          assistantMode = "fallback"
          reply =
            "I could not find clear next-course recommendations from your current record. Try importing more academic history or adjusting major/year."
        } else {
          assistantMode = "llm"
          const lines = recommended.map(
            (r) => `• **${r.courseCode}** — ${r.reasons.slice(0, 2).join("; ") || "eligible next option"}`,
          )
          const blockedLine =
            blocked.length > 0
              ? `\n\nBlocked for now:\n${blocked
                  .map((b) => {
                    const candidate = candidateByCode.get(b.courseCode)
                    const prereqText =
                      candidate && b.missingPrereqs?.length
                        ? formatMissingFromGroups(candidate.prerequisiteGroups, b.missingPrereqs)
                        : ""
                    const coreqText =
                      candidate && b.missingCoreqs?.length
                        ? formatMissingFromGroups(candidate.corequisiteGroups, b.missingCoreqs)
                        : ""
                    const prereq = prereqText
                      ? `missing prereq: ${prereqText}`
                      : b.missingPrereqs?.length
                        ? `missing prereq: ${b.missingPrereqs.join(", ")}`
                        : ""
                    const coreq = coreqText
                      ? `missing coreq: ${coreqText}`
                      : b.missingCoreqs?.length
                        ? `missing coreq: ${b.missingCoreqs.join(", ")}`
                        : ""
                    const why = [prereq, coreq].filter(Boolean).join("; ")
                    return `• **${b.courseCode}** — ${why || b.reasons.slice(0, 1).join("; ") || "currently blocked"}`
                  })
                  .join("\n")}`
              : ""
          reply = `Based on completed coursework, here are recommended next courses (${engine} engine):\n${lines.join(
            "\n",
          )}${blockedLine}`
        }
      }
    } else if (shouldAttemptScheduleSolve(message)) {
      assistantMode = "schedule"
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
        assistantMode = "help"
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
            assistantMode = "llm"
            reply = out.text
          } else {
            assistantMode = "fallback"
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
              assistantMode = "llm"
            } catch (e) {
              assistantMode = "fallback"
              reply = `The AI model is unavailable (${e instanceof Error ? e.message : "error"}). You can still ask me to **schedule specific courses** with rules (e.g. no Fridays, end by 6 PM).`
            }
          } else {
            assistantMode = "fallback"
            reply =
              "I can **look up rooms, times, instructors**, check **whether a course appears for a term** using catalog meeting dates (e.g. “Can CIS 375 be taken Fall 2026?”), **build schedules** with rules (no Fridays, end by 6 PM), and answer **imports / conflicts / tabs**. For other open-ended questions, set **GEMINI_API_KEY** (Google AI Studio) or **HUGGINGFACE_API_KEY** / **HF_TOKEN** on the server."
          }
        }
      }
    }

    return NextResponse.json({ reply, scheduleSuggestion, assistantMode, llmAvailable })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg === "Unauthorized") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    console.error(e)
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}
