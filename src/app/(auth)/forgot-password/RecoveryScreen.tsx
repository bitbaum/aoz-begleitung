'use client'

import type { ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import { RecoveryForm } from '@/components/auth/AuthForms'

type Props = Omit<ComponentProps<typeof RecoveryForm>, 'onBack'>

export function RecoveryScreen(props: Props) {
  const router = useRouter()
  return <RecoveryForm {...props} onBack={() => router.push('/login')} />
}
