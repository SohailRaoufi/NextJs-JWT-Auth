import { withAuth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    return NextResponse.json({
      message: 'This is a protected route',
      user: user,
    });
  });
}
