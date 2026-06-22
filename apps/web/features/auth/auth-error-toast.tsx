'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function AuthErrorToast({ hasError }: { hasError: boolean }) {
  useEffect(() => {
    if (hasError) {
      toast.error('Connection failed. Please allow third-party cookies and retry.');
    }
  }, [hasError]);

  return null;
}
