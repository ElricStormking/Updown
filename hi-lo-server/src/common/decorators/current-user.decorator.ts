import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface';

type RequestWithUser = {
  user?: AuthUser;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Current user unavailable');
    }
    return request.user;
  },
);
