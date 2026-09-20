'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CallbackRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams ? searchParams.toString() : '';
    router.replace(`/auth/callback${q ? `?${q}` : ''}`);
  }, [router, searchParams]);

  return null;
}
