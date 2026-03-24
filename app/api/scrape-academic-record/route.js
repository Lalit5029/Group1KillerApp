import { NextResponse } from "next/server";
import { login } from "../../../backend/src/myslice_scraper.js";

// Ensure this route is dynamic
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    console.log("Received academic record scrape request");

    // Ensure request body is valid JSON
    const body = await request.json();
    const { username, password, manualLogin } = body;

    console.log("Manual login mode:", manualLogin ? "Yes" : "No");

    if (!manualLogin && (!username || !password)) {
      console.log("Missing credentials");
      return NextResponse.json(
        { error: "Username and password are required unless manual login mode is used" },
        { status: 400 }
      );
    }

    console.log("Attempting to login to MySlice...");
    // Login to MySlice
    const result = await login(username, password, Date.now().toString(), {
      manualLogin: Boolean(manualLogin),
    });

    console.log("Login successful, fetching course history...");
    // Get course history
    const courses = result.courses;
    const blocks = result.blocks || [];
    console.log("Course history fetched successfully");

    return NextResponse.json({ success: true, courses, blocks });
  } catch (error) {
    console.error("Academic record scrape error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to scrape academic record" },
      { status: 500 }
    );
  }
}
