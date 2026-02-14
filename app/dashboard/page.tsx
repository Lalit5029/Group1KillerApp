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

export default function DashboardPage() {
  const [data, setData] = useState<DemoProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/demo-progress")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Run npm run db:seed first" : "Failed to load");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error)
    return (
      <div className="p-8">
        <p className="text-red-600">{error}</p>
        <p className="mt-2 text-sm text-gray-600">In the project root run: npm run db:seed</p>
        <Link href="/" className="mt-4 inline-block text-blue-600 underline">Back home</Link>
      </div>
    );
  if (!data) return null;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Dashboard — Data from MongoDB</h1>
      <p className="text-gray-600 mb-6">
        This page reads from MongoDB via Prisma. Demo user: {data.user.email}
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Total credits</h2>
        <p className="text-2xl">{data.totalCredits}</p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Completed courses</h2>
        <ul className="list-disc pl-6 space-y-1">
          {data.academicCourses.map((c) => (
            <li key={c.id}>
              {c.code} — {c.name} ({c.credits} cr) — {c.term}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Degree requirement categories</h2>
        <ul className="list-disc pl-6 space-y-1">
          {data.degreeRequirements.map((r) => (
            <li key={r.id}>{r.title} — {r.status}</li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-gray-500">
        Log in as demo@group1.local / demo123 to use the full academic progress page.
      </p>
      <div className="mt-4 flex gap-4">
        <Link href="/login" className="text-blue-600 underline">Login</Link>
        <Link href="/academic-progress" className="text-blue-600 underline">Academic Progress</Link>
        <Link href="/" className="text-blue-600 underline">Home</Link>
      </div>
    </div>
  );
}
