import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Wallet } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWalletByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getOrCreateWallet(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Wallet> {
    const client = tx ?? this.prisma;
    const wallet = await client.wallet.findUnique({
      where: { userId },
    });

    if (wallet) {
      return wallet;
    }

    return client.wallet.create({
      data: {
        userId,
        balance: new Prisma.Decimal(0),
        currency: 'USDT',
      },
    });
  }

  async adjustBalance(
    userId: string,
    amount: Prisma.Decimal | number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const wallet = await this.getOrCreateWallet(userId, client);
    const numericAmount =
      amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);

    return client.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: new Prisma.Decimal(wallet.balance).add(numericAmount),
      },
    });
  }
}
