import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { IntegrationResponseDto } from '../dto/integration-response.dto';
import {
  IntegrationErrorCodes,
  IntegrationErrorMessages,
} from '../utils/error-codes';

@Catch(HttpException)
export class IntegrationApiExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const message = this.extractMessage(exception);

    response.status(200).json(
      IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        message || IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      ),
    );
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
