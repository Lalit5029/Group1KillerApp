import { NextResponse } from "next/server";

// No-op endpoint so scraper log updates do not fail when running
// through Next.js-only local dev (without backend API on :3001).
export async function POST() {
  return NextResponse.json({ success: true });
}

