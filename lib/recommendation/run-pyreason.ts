import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { InferenceResult, PyReasonPayload } from "./types";

type PyReasonRunResult = {
  engine: "pyreason";
  results: InferenceResult[];
  rawTrace?: unknown;
};

/**
 * Execute the isolated Python reasoning module.
 *
 * The Next.js route intentionally shells out to Python here so PyReason stays
 * isolated from the UI/runtime and can evolve independently of the React app.
 */
export async function runPyReason(payload: PyReasonPayload): Promise<PyReasonRunResult> {
  const scriptPath = path.join(process.cwd(), "backend", "src", "reasoning", "pyreason_recommender.py");
  const venvPython = path.join(process.cwd(), "backend", ".venv", "bin", "python");
  const pythonExecutable = fs.existsSync(venvPython) ? venvPython : "python3";
  const timeoutMs = 15000;

  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable, [scriptPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeoutHandle = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`PyReason timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutHandle);
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `PyReason process exited with code ${code}`
          )
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve({
          engine: "pyreason",
          results: Array.isArray(parsed.results) ? parsed.results : [],
          rawTrace: parsed.rawTrace,
        });
      } catch (error) {
        reject(
          new Error(
            `Failed to parse PyReason output: ${
              error instanceof Error ? error.message : "unknown error"
            }`
          )
        );
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
