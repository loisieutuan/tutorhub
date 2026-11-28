
import { createClient } from '@supabase/supabase-js'

// Kiểm tra biến môi trường
function requireEnv(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Thiếu biến môi trường: ${name}`)
  }

  return value.trim()
}

// Lấy thông tin kết nối Supabase
const supabaseUrl = requireEnv(
  import.meta.env.VITE_SUPABASE_URL,
  'VITE_SUPABASE_URL',
)

const supabasePublishableKey = requireEnv(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'VITE_SUPABASE_PUBLISHABLE_KEY',
)

// Chỉ cho phép sử dụng publishable key ở frontend
if (!supabasePublishableKey.startsWith('sb_publishable_')) {
  throw new Error(
    'Hãy sử dụng Supabase Publishable key cho frontend.',
  )
}

// Khởi tạo Supabase Client
export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
)

// Kiểm tra kết nối với Supabase Auth API
export async function checkSupabaseConnection() {
  const endpoint = new URL(
    '/auth/v1/health',
    supabaseUrl,
  )

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: supabasePublishableKey,
    },
  })

  if (!response.ok) {
    throw new Error(
      `Kết nối Supabase thất bại: HTTP ${response.status}`,
    )
  }

  return 'LST Learning: Kết nối Supabase thành công!'
}
