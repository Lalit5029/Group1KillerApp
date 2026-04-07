/** Short answers about this app for the assistant (no LLM required). */

export function matchHelpAnswer(message: string): string | null {
  const q = message.toLowerCase()

  if (/hide grade|presentation|demo mode|projector/i.test(q)) {
    return "Use **Hide grades** in the top header (next to the theme toggle). It masks letter grades and sensitive GPA alerts on screen while the planner still uses your real data behind the scenes."
  }
  if (/import|myslice|transcript|academic history/i.test(q)) {
    return "Open the **Academic** tab. Use **Import from MySlice** to load a student’s record, or work with data already saved for that student. The **Schedule** tab is where you build sections from the catalog."
  }
  if (/conflict|overlap|same time/i.test(q)) {
    return "The planner flags **time overlaps** when two selected sections meet on the same day with overlapping times. Open the course search, pick a different section, or remove one of the conflicting classes."
  }
  if (/requirement|degree|graduat|major/i.test(q) && /tab|where|how/i.test(q)) {
    return "Use the **Degree requirements** tab for graduation checks, advisor alerts, and the CS roadmap timeline. Requirements reference text is also shown there for advisors."
  }
  if (/what-?if|scratch/i.test(q)) {
    return "The **What-if** planner lets you try a temporary schedule against your baseline and apply it when you are ready."
  }
  if (/who|team|project|about (the )?(app|site)/i.test(q)) {
    return "This is the Syracuse **advisor course planner**: search offerings, build schedules, check conflicts, and review CS graduation context. It does not replace **DegreeWorks** for official degree certification."
  }

  return null
}

export const ASSISTANT_SYSTEM_PRIMER = `You are the in-app assistant for the Syracuse University advisor Course Planner.
Be concise. Your main job is helping advisors use: Schedule (search/add sections), Academic (import/history), Degree requirements (alerts + CS roadmap).
If the user asks a simple off-topic question (arithmetic like "what is 2+2", short definitions, trivia), answer directly in a sentence or two—do not refuse or tell them to use a calculator unless the task is genuinely unsuitable.
You do NOT replace DegreeWorks. If unsure about degree rules, say to verify in DegreeWorks or with the department.
`
