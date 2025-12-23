import { Injectable } from '@nestjs/common';
import { Prisma, User, Wallet } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

export type UserWithWallet = User & { wallet?: Wallet | null };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreateUserDto & { password: string; initialBalance?: Prisma.Decimal },
  ): Promise<UserWithWallet> {
    return this.prisma.user.create({
      data: {
        email: data.account, // Using email column to store account identifier
        password: data.password,
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
