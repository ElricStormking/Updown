import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { LaunchSessionStartResponseDto } from '../dto';
import {
  IntegrationErrorCodes,
  IntegrationErrorMessages,
} from '../utils/error-codes';

@Catch(HttpException)
export class LaunchSessionExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const message = this.extractMessage(exception);

    const payload: LaunchSessionStartResponseDto = {
      ready: false,
      mode: 'callback',
      code: IntegrationErrorCodes.LAUNCH_SESSION_NOT_ACTIVE,
      message:
        message ||
        IntegrationErrorMessages[IntegrationErrorCodes.LAUNCH_SESSION_NOT_ACTIVE],
    };

    response.status(200).json(payload);
  }

  private extractMessage(exception: HttpException): string {
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return payload;
    }
    if (payload && typeof payload === 'object') {
      const maybeMessage = (payload as { message?: unknown }).message;
      if (Array.isArray(maybeMessage)) {
        return maybeMessage
          .map((entry) => String(entry))
          .filter(Boolean)
          .join('; ');
      }
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        return maybeMessage;
      }
    }
    return exception.message;
  }
}
