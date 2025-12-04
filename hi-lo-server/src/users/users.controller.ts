import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    const dbUser = await this.usersService.findById(user.userId);
    if (!dbUser) {
      throw new NotFoundException('User not found');
    }

    return this.usersService.toPublic(dbUser);
  }
}
