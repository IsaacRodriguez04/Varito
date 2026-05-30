'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <Button
      variant="destructive"
      className="w-full"
      onClick={handleSignOut}
      disabled={loading}
    >
      <LogOut className="h-4 w-4 mr-2" />
      {loading ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </Button>
  )
}
