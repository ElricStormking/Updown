export class IntegrationResponseDto<T = null> {
  success: boolean;
  errorCode: number;
  errorMessage: string;
  data: T | null;

  static success<T>(data: T): IntegrationResponseDto<T> {
    const response = new IntegrationResponseDto<T>();
    response.success = true;
    response.errorCode = 0;
    response.errorMessage = '';
    response.data = data;
    return response;
  }

  static error<T = any>(
    errorCode: number,
    errorMessage: string,
  ): IntegrationResponseDto<T> {
    const response = new IntegrationResponseDto<T>();
    response.success = false;
    response.errorCode = errorCode;
    response.errorMessage = errorMessage;
    response.data = null;
    return response;
  }
}
