import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';
import { UsersService, UserWithWallet } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.account);
    if (existingUser) {
      throw new BadRequestException('Account already registered');
    }

    const saltRounds = Number(
      this.configService.get<number>('auth.saltRounds', { infer: true }) ?? 12,
    );
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);
    const newUser = await this.usersService.create({
      account: dto.account,
      password: passwordHash,
    });

    return this.buildAuthResponse(newUser);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.account);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('Account is disabled');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async validatePayload(payload: JwtPayload): Promise<UserWithWallet> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('Account is disabled');
    }

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.usersService.toPublic(user);
  }

  private async buildAuthResponse(
    user: UserWithWallet,
  ): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      account: user.email,
      type: 'user',
    };

    const expiresInRaw =
      this.configService.get<string>('auth.jwtExpiresIn') ?? '1h';
    const expiresIn = expiresInRaw as any;
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('auth.jwtSecret') ?? 'change-me',
      expiresIn,
    });
    const adminAccounts =
      this.configService.get<string[]>('admin.accounts') ?? [];
    const isAdmin = adminAccounts.includes(user.email);

    return {
      accessToken,
      user: {
        id: user.id,
        account: user.email,
        isAdmin,
      },
    };
  }
}
