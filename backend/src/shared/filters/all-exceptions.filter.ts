import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Filtro global de erros: nunca expoe stack trace ou detalhes internos
 * ao cliente, mas registra tudo no servidor.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.resolve(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const payload =
        typeof res === 'string'
          ? { message: res }
          : (res as Record<string, unknown>);

      const details = Array.isArray(payload['message'])
        ? payload['message']
        : undefined;

      return {
        status,
        body: {
          error: {
            code: details
              ? 'VALIDATION_ERROR'
              : this.codeForStatus(status),
            message: this.messageFrom(payload),
            details,
          },
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrisma(exception);
    }

    // Dados invalidos para o Prisma (ex.: tipo/valor inesperado) sao erro do
    // cliente, nao do servidor.
    if (
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      this.logger.warn(
        `Erro de validacao do banco: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
      );
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados invalidos na requisicao',
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor',
        },
      },
    };
  }

  private resolvePrisma(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: ErrorBody;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: 'CONFLICT',
              message: 'Registro duplicado: ja existe um item com este valor unico',
            },
          },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            error: { code: 'NOT_FOUND', message: 'Registro nao encontrado' },
          },
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            error: {
              code: 'FOREIGN_KEY_CONSTRAINT',
              message: 'Referencia invalida para um registro relacionado',
            },
          },
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            error: { code: 'DATABASE_ERROR', message: 'Erro ao processar a requisicao' },
          },
        };
    }
  }

  private messageFrom(payload: Record<string, unknown>): string {
    const message = payload['message'];
    if (Array.isArray(message)) {
      return 'Dados invalidos na requisicao';
    }
    if (typeof message === 'string') {
      return message;
    }
    return 'Erro ao processar a requisicao';
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      default:
        return 'ERROR';
    }
  }
}
