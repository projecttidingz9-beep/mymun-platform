import { NextResponse } from "next/server";
import { logger } from "./logger";

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function serverError(message: string, context?: Record<string, unknown>) {
  logger.error(message, context);
  return NextResponse.json({ error: message }, { status: 500 });
}

