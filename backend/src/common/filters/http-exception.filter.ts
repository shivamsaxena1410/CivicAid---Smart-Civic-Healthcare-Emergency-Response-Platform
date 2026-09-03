import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';

/**
 * Maps Prisma's known request errors onto HTTP status codes.
 *
 * Without this, a duplicate email on registration surfaced as a 500 with the
 * raw Prisma message — which names the table and the constrained columns. The
 * client sees a useful status and a neutral sentence; the details go to the log.
 */
function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
  status: HttpStatus;
  code: string;
  message: string;
} {
  switch (exception.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        code: 'DUPLICATE_RECORD',
        message: 'A record with these details already exists.',
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'The requested record was not found.',
      };
    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'INVALID_REFERENCE',
        message: 'A referenced record does not exist.',
      };
    case 'P2014':
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'INVALID_RELATION',
        message: 'This change would break a required relationship between records.',
      };
    case 'P2023':
      // Malformed id in a path parameter (e.g. a non-UUID where the column is
      // uuid). The resource cannot exist, and answering 404 keeps the response
      // identical to a well-formed id that matches nothing.
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'The requested record was not found.',
      };
    default:
      // Anything else — a failed raw query, a timeout, a constraint we did not
      // anticipate — is a server-side fault. Reporting it as 400 blames the
      // client for our bug and hides it from error-rate monitoring.
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred. Please try again later.',
      };
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Correlation id: the client is given an opaque reference and the full
    // error is logged under the same id. That is what makes it safe to keep
    // internal messages out of the response — support can still find the cause.
    const correlationId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'An unexpected server error occurred. Please try again later.';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        errorCode = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as { message?: string | string[]; error?: string; details?: unknown };
        message = resObj.message ?? exception.message;
        errorCode = resObj.error ?? exception.name;
        details = resObj.details ?? (Array.isArray(resObj.message) ? resObj.message : null);
      }

      // 5xx raised as HttpException is still an internal fault; log it with the
      // stack so it is not lost among ordinary 4xx traffic.
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(`[${correlationId}] ${request.method} ${request.url} — ${exception.message}`, exception.stack);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = mapPrismaError(exception);
      status = mapped.status;
      errorCode = mapped.code;
      message = mapped.message;
      const line = `[${correlationId}] ${request.method} ${request.url} — Prisma ${exception.code}: ${exception.message}`;
      // Unmapped Prisma codes are our bug, not the caller's; log at error level
      // with the stack so they surface instead of blending into 4xx noise.
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(line, exception.stack);
      } else {
        this.logger.warn(line);
      }
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      // The database is unreachable. 503 rather than 500: the request is
      // legitimate and will succeed once the dependency recovers.
      status = HttpStatus.SERVICE_UNAVAILABLE;
      errorCode = 'DATABASE_UNAVAILABLE';
      message = 'The service is temporarily unavailable. Please try again shortly.';
      this.logger.error(`[${correlationId}] Database unavailable: ${exception.message}`);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      errorCode = 'INVALID_REQUEST';
      message = 'The request could not be processed.';
      this.logger.error(`[${correlationId}] Prisma validation error: ${exception.message}`);
    } else if (exception instanceof Error) {
      // Deliberately NOT `message = exception.message`. An unhandled error's
      // message is written for developers and routinely contains file paths,
      // connection strings, SQL fragments and internal identifiers. The client
      // gets the generic sentence above plus the correlation id.
      this.logger.error(
        `[${correlationId}] Unhandled ${exception.name} on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(`[${correlationId}] Non-Error thrown on ${request.method} ${request.url}: ${String(exception)}`);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error: {
        code: errorCode,
        message: Array.isArray(message) ? message[0] : message,
        details: details ?? (Array.isArray(message) ? message : undefined),
      },
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
