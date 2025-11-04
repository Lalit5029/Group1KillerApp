import { NextResponse } from "next/server";
import { login, getCourseHistory } from "@/lib/myslice_scraper";

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
    // Login to MySlice
    await login(username, password);

    console.log("Login successful, fetching course history...");
    // Get course history
    const courses = await getCourseHistory();
    console.log("Course history fetched successfully");

    return NextResponse.json({ success: true, courses });
  } catch (error) {
    console.error("MySlice import error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import from MySlice" },
      { status: 500 }
    );
  }
}
