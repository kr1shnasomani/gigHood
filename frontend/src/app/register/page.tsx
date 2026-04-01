'use client';

import { Suspense } from 'react';
import RegisterFormContent from '@/app/register/register-form';

function RegisterLoadingFallback() {
  return (
    <main className="page-content" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div className="spinner" />
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterLoadingFallback />}>
      <RegisterFormContent />
    </Suspense>
  );
}
