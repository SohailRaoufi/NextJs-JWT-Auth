import { HttpStatusCode } from 'axios';
import { STATUS_CODES } from 'http';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * ----------------------------------------------
 * API Errors
 * ----------------------------------------------
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    const { message, status } = error;
    return NextResponse.json(
      { message, status, error: STATUS_CODES[status] || 'Unknown Error' },
      { status }
    );
  }
  return NextResponse.json(
    {
      error: STATUS_CODES[HttpStatusCode.InternalServerError],
      status: HttpStatusCode.InternalServerError,
    },
    { status: HttpStatusCode.InternalServerError }
  );
}

/**
 * -------------------------------------------
 * Form or ZOD Error
 * -------------------------------------------
 */

export const handleZodError = (errors: ZodError) => {
  return NextResponse.json(
    {
      error: STATUS_CODES[HttpStatusCode.UnprocessableEntity],
      status: HttpStatusCode.UnprocessableEntity,
      errors: errors.formErrors.fieldErrors,
    },
    { status: HttpStatusCode.UnprocessableEntity }
  );
};
