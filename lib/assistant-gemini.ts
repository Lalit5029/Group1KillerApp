import { GoogleGenerativeAI } from "@google/generative-ai"
import type { Content } from "@google/generative-ai"

const MAX_HISTORY_MESSAGES = 16

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const trimmed = String(key || "").trim()
  return trimmed || null
}

type HistoryItem = { role: string; content: string }

/**
 * Gemini for open-ended assistant replies. Catalog / schedule paths stay rule-based.
 */
export async function generateGeminiAssistantReply(
  systemInstruction: string,
  history: HistoryItem[],
  userMessage: string,
): Promise<{ text: string } | { error: string }> {
  const key = getGeminiApiKey()
  if (!key) return { error: "Missing Gemini API key" }

  // gemini-1.5-* often 404s on current v1beta; use a current stable id (override with GEMINI_MODEL).
  const modelName = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim()
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  })

  const slice = history.slice(-MAX_HISTORY_MESSAGES)
  const contents: Content[] = []
  for (const h of slice) {
    const role = h.role === "assistant" ? "model" : "user"
    const text = String(h.content || "").trim()
    if (!text) continue
    contents.push({ role, parts: [{ text }] })
  }

  while (contents.length > 0 && contents[0].role !== "user") {
    contents.shift()
  }

  const chat = model.startChat({ history: contents })
  try {
    const result = await chat.sendMessage(userMessage)
    const text = result.response.text()
    if (!text?.trim()) return { error: "Empty model response" }
    return { text: text.trim() }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gemini request failed" }
  }
}
