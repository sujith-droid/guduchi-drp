import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function RedirectToLogin() {
  useEffect(() => {
    base44.auth.redirectToLogin(window.location.href);
  }, []);
  return null;
}