"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AcademicCourse = {
  id: string;
  code: string;
  name: string;
  term: string;
  credits: string;
  requirementGroup: string | null;
};

type DegreeRequirement = {
  id: string;
  title: string;
  status: string;
  courses: unknown;
};

type DemoProgress = {
  user: { name: string | null; email: string | null };
  totalCredits: number;
  academicCourses: AcademicCourse[];
  degreeRequirements: DegreeRequirement[];
};

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "complete" || s === "completed") {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
        Complete
      </span>
    );
  }
  if (s === "in progress" || s === "inprogress") {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200">
        In Progress
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
      Not Started
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DemoProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/demo-progress")
      .then((res) => {
        if (!res.ok)
          throw new Error(res.status === 404 ? "Run npm run db:seed first" : "Failed to load");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading...</p>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full shadow-sm">
          <p className="text-red-500 font-semibold mb-2">{error}</p>
          <p className="text-sm text-gray-500 mb-4">In the project root run: <code className="bg-gray-100 text-orange-600 px-2 py-0.5 rounded text-xs">npm run db:seed</code></p>
          <Link href="/" className="text-[#F76900] text-sm font-medium hover:underline">← Back home</Link>
        </div>
      </div>
    );

  if (!data) return null;

  const uniqueDepts = new Set(data.academicCourses.map((c) => c.code.match(/^[A-Z]+/)?.[0] ?? "")).size;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">

      {/* NAVBAR */}
      <nav className="bg-[#002147] border-b border-[#002147] px-8 h-[62px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#F76900] rounded-lg flex items-center justify-center font-extrabold text-sm text-white tracking-tight">
            SU
          </div>
          <span className="text-[17px] font-bold text-white">
            Course <span className="text-[#F76900]">Scheduler</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-xs font-bold text-[#F76900]">
              {data.user.email?.[0]?.toUpperCase() ?? "D"}
            </div>
            {data.user.email}
          </div>
          <Link href="/" className="text-gray-300 text-sm font-medium hover:text-white transition-colors">Home</Link>
          <Link href="/login" className="text-gray-300 text-sm font-medium hover:text-white transition-colors">Login</Link>
          <Link href="/academic-progress" className="text-gray-300 text-sm font-medium hover:text-white transition-colors">Academic Progress</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* PAGE HEADER */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Academic data for <span className="text-[#F76900] font-medium">{data.user.email}</span> — sourced from MongoDB via Prisma.
          </p>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Total Credits</p>
            <p className="text-4xl font-extrabold leading-none text-gray-900">{data.totalCredits}</p>
            <p className="text-xs text-gray-400 mt-2">Across all completed courses</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Completed Courses</p>
            <p className="text-4xl font-extrabold leading-none text-gray-900">{data.academicCourses.length}</p>
            <p className="text-xs text-gray-400 mt-2">
              Across <span className="text-green-600 font-semibold">{uniqueDepts}</span> department{uniqueDepts !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Requirements Met</p>
            <p className="text-4xl font-extrabold leading-none text-gray-900">
              {data.degreeRequirements.filter((r) => r.status.toLowerCase().includes("complete")).length}
              <span className="text-lg font-medium text-gray-400"> / {data.degreeRequirements.length}</span>
            </p>
            <p className="text-xs text-gray-400 mt-2">
              <span className="text-[#F76900] font-semibold">
                {data.degreeRequirements.filter((r) => !r.status.toLowerCase().includes("complete")).length} remaining
              </span>
            </p>
          </div>
        </div>

        {/* COMPLETED COURSES */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Completed Courses</h2>
          </div>
          <div className="grid grid-cols-[90px_1fr_70px_90px_110px] gap-3 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
            <span>Code</span><span>Course Name</span><span className="text-center">Credits</span><span>Term</span><span>Requirement</span>
          </div>
          {data.academicCourses.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[90px_1fr_70px_90px_110px] gap-3 px-6 py-3 border-b border-gray-100 last:border-0 hover:bg-orange-50 transition-colors text-sm items-center cursor-pointer"
            >
              <span className="text-[#F76900] font-bold text-xs">{c.code}</span>
              <span className="text-gray-800 font-medium">{c.name}</span>
              <span className="text-gray-400 text-xs text-center">{c.credits} cr</span>
              <span className="text-gray-400 text-xs">{c.term}</span>
              <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded-full text-center whitespace-nowrap">
                {c.requirementGroup ?? "—"}
              </span>
            </div>
          ))}
        </div>

        {/* DEGREE REQUIREMENTS */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Degree Requirement Categories</h2>
          </div>
          {data.degreeRequirements.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-6 py-3 border-b border-gray-100 last:border-0 hover:bg-orange-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-800">{r.title}</span>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>



      </main>

      <footer className="bg-[#002147] border-t border-[#002147] text-center py-4 text-xs text-gray-400">
        <strong className="text-[#F76900]">Syracuse University</strong> · Course Scheduler · CIS454 Software Engineering
      </footer>
    </div>
  );
}