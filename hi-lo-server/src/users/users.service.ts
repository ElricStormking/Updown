import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, User, Wallet } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

export type UserWithWallet = User & { wallet?: Wallet | null };
const DEFAULT_MERCHANT_ID = process.env.SEED_MERCHANT_ID ?? 'TEST_MERCHANT';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreateUserDto & {
      password: string;
      initialBalance?: Prisma.Decimal;
      merchantId?: string;
      merchantAccount?: string | null;
    },
  ): Promise<UserWithWallet> {
    const merchantId = (data.merchantId ?? DEFAULT_MERCHANT_ID).trim();
    if (!merchantId) {
      throw new BadRequestException('merchantId is required');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { merchantId },
      select: { merchantId: true },
    });
    if (!merchant) {
      throw new BadRequestException(`Merchant ${merchantId} not found`);
    }

    return this.prisma.user.create({
      data: {
        email: data.account, // Using email column to store account identifier
        password: data.password,
        merchantId,
        merchantAccount: data.merchantAccount ?? data.account,
        wallet: {
          create: {
            balance: data.initialBalance ?? new Prisma.Decimal(0),
            currency: 'USDT',
          },
        },
      },
      include: {
        wallet: true,
      },
    });
  }

  findByEmail(email: string): Promise<UserWithWallet | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { wallet: true },
    });
  }

  findById(id: string): Promise<UserWithWallet | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
  }

  toPublic(user: UserWithWallet): Omit<UserWithWallet, 'password'> {
    const { password, ...rest } = user;
    return rest;
  }
}
