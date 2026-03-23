'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AcademicProgressPage() {
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
