import { ApiError, handleApiError, handleZodError } from '@/lib/api-error';
import { generateToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { verifyHash } from '@/lib/hash';
import { loginSchema } from '@/lib/validations/login.schema';
import { HttpStatusCode } from 'axios';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const parsedData = loginSchema.safeParse(data);

    if (!parsedData.success) {
      return handleZodError(parsedData.error);
    }

    const { email, password } = parsedData.data;

    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!user) {
      throw new ApiError(
        'Invalid Credentials',
        HttpStatusCode.UnprocessableEntity
      );
    }

    if (!(await verifyHash(user.password, password))) {
      throw new ApiError(
        'Invalid Credentials',
        HttpStatusCode.UnprocessableEntity
      );
    }

    const token = await generateToken(user);

    return NextResponse.json({ token }, { status: HttpStatusCode.Ok });
  } catch (e) {
    console.log(e);

    return handleApiError(e);
  }
}
