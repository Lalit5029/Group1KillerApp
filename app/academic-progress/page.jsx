'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AcademicProgressRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');

  useEffect(() => {
    if (studentId) {
      router.replace(`/?studentId=${encodeURIComponent(studentId)}`);
      return;
    }

    router.replace('/students');
  }, [router, studentId]);

  return (
    <main className="min-h-screen p-8 text-sm text-slate-600">
      Redirecting to the selected student workspace...
    </main>
  );
}

export default function AcademicProgressPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8 text-sm text-slate-600">
          Loading…
        </main>
      }
    >
      <AcademicProgressRedirect />
    </Suspense>
  );
}
