
import { supabase } from './supabase'

export type AccountRole =
  | 'tutor'
  | 'student'
  | 'parent'

export type UserProfile = {
  id: string
  full_name: string
  username: string | null
  role: AccountRole
  is_active: boolean
}

export const roleLabels: Record<AccountRole, string> = {
  tutor: 'Gia sư',
  student: 'Học sinh',
  parent: 'Phụ huynh',
}

// Domain danh rieng cho tai khoan thu nghiem
const DEMO_ACCOUNT_DOMAIN = 'example.com'

// Kiem tra vai tro
function isAccountRole(
  value: unknown,
): value is AccountRole {
  return (
    value === 'tutor' ||
    value === 'student' ||
    value === 'parent'
  )
}

// Chuyen username thanh email dinh danh
function getLoginEmail(
  role: AccountRole,
  identifier: string,
): string {
  const value = identifier.trim().toLowerCase()

  if (!value) {
    throw new Error(
      'Vui lòng nhập thông tin đăng nhập.',
    )
  }

  if (role === 'tutor') {
    return value
  }

  if (!/^[a-z0-9][a-z0-9_]{2,31}$/.test(value)) {
    throw new Error(
      'Tên đăng nhập phải có từ 3 đến 32 ký tự, gồm chữ không dấu, số hoặc dấu gạch dưới.',
    )
  }

  return `${role}-${value}@${DEMO_ACCOUNT_DOMAIN}`
}

// Dang nhap
export async function signIn(
  role: AccountRole,
  identifier: string,
  password: string,
) {
  const email = getLoginEmail(role, identifier)

  if (!password) {
    throw new Error(
      'Vui lòng nhập mật khẩu hoặc mã truy cập.',
    )
  }

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    })

  if (error) {
    if (error.status === 429) {
      throw new Error(
        'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
      )
    }

    throw new Error(
      'Không thể đăng nhập. Vui lòng kiểm tra thông tin tài khoản hoặc kết nối mạng.',
    )
  }
}

// Lay ho so nguoi dang nhap
export async function getOwnProfile(
  expectedUserId: string,
): Promise<UserProfile> {
  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser()

  if (
    userError ||
    userData.user?.id !== expectedUserId
  ) {
    throw new Error(
      'Không thể xác thực phiên đăng nhập.',
    )
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, username, role, is_active',
    )
    .eq('id', expectedUserId)
    .maybeSingle()

  if (error) {
    throw new Error(
      'Không thể đọc hồ sơ. Hãy kiểm tra kết nối và quyền RLS.',
    )
  }

  if (!data) {
    throw new Error(
      'Tài khoản chưa được liên kết với hồ sơ LST Learning.',
    )
  }

  if (!data.is_active) {
    throw new Error(
      'Tài khoản đang bị vô hiệu hóa. Vui lòng liên hệ gia sư.',
    )
  }

  if (!isAccountRole(data.role)) {
    throw new Error(
      'Vai trò tài khoản không hợp lệ.',
    )
  }

  return {
    id: data.id,
    full_name: data.full_name,
    username: data.username,
    role: data.role,
    is_active: data.is_active,
  }
}

// Dang xuat
export async function signOut() {
  const { error } = await supabase.auth.signOut({
    scope: 'local',
  })

  if (error) {
    throw new Error(
      'Không thể đăng xuất. Vui lòng thử lại.',
    )
  }
}
