import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Required for @supabase/ssr cookie handling in Server Components
  },
}

export default nextConfig

