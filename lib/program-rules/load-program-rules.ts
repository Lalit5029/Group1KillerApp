import fs from "fs";
import path from "path";
import type { ProgramRequirementRule, ProgramRules } from "./types";

function isValidRequirementRule(rule: unknown): rule is ProgramRequirementRule {
  if (!rule || typeof rule !== "object") {
    return false;
  }

  const candidate = rule as Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.title !== "string") {
    return false;
  }

  if (candidate.kind === "all_of") {
    return Array.isArray(candidate.courses);
  }

  if (candidate.kind === "choose_n") {
    return typeof candidate.count === "number" && Array.isArray(candidate.options);
  }

  if (candidate.kind === "credit_bucket") {
    return (
      typeof candidate.minimumCredits === "number" &&
      typeof candidate.candidatePoolId === "string"
    );
  }

  return false;
}

function isValidProgramRules(value: unknown): value is ProgramRules {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.programId === "string" &&
    typeof candidate.programName === "string" &&
    typeof candidate.majorKey === "string" &&
    typeof candidate.minimumCredits === "number" &&
    !!candidate.gradePolicies &&
    typeof candidate.gradePolicies === "object" &&
    !!candidate.candidatePools &&
    typeof candidate.candidatePools === "object" &&
    Array.isArray(candidate.requirementGroups) &&
    candidate.requirementGroups.every(isValidRequirementRule) &&
    !!candidate.roadmap &&
    typeof candidate.roadmap === "object"
  );
}

/**
 * Load the structured CS program rules from disk.
 *
 * Phase 1 keeps this intentionally simple: one typed JSON file that becomes the
 * stable source of truth for later deterministic degree-progress logic.
 */
export function loadComputerScienceProgramRules(): ProgramRules {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "program_rules",
    "computer_science_bs.json"
  );

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!isValidProgramRules(parsed)) {
    throw new Error("Invalid Computer Science program rules file");
  }

  return parsed;
}
