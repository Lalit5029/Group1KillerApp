import { NextResponse } from "next/server";
import { login } from "../../../backend/src/myslice_scraper.js";

// Ensure this route is dynamic
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    console.log("Received MySlice import request");

    // Ensure request body is valid JSON
    const body = await request.json();
    const { username, password } = body;

    console.log("Username received:", username ? "Yes" : "No");

    if (!username || !password) {
      console.log("Missing credentials");
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    console.log("Attempting to login to MySlice...");
    const jobId = Date.now().toString();
    const result = await login(username, password, jobId, { manualLogin: false });

    console.log("Login successful, course history included in result");
    const courses = result.courses;
    const blocks = result.blocks || [];

    return NextResponse.json({ success: true, courses, blocks });
  } catch (error) {
    console.error("MySlice import error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import from MySlice" },
      { status: 500 }
    );
  }
}
