import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/auth'
import { findUserById } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ success: false, user: null })
    }

    const user = await findUserById(userId)
    if (!user) {
      return NextResponse.json({ success: false, user: null })
    }
    return NextResponse.json({ success: true, user: { id: user.id, email: user.email } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
