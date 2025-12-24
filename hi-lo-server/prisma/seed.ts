import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const account = process.env.SEED_USER_ACCOUNT ?? 'demo_account';
  const password = process.env.SEED_USER_PASSWORD ?? 'changeme';
  const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS ?? 12);

  const passwordHash = await bcrypt.hash(password, saltRounds);

  const startingBalance = process.env.SEED_USER_BALANCE ?? '1000';
  const balanceDecimal = new Prisma.Decimal(startingBalance);

  const user = await prisma.user.upsert({
    where: { email: account },
    update: {
      password: passwordHash,
    },
    create: {
      email: account, // store account identifier in email column
      password: passwordHash,
      wallet: {
        create: {
          balance: balanceDecimal,
          currency: 'USDT',
        },
      },
    },
    include: {
      wallet: true,
    },
  });

  console.log(
    `✅ Seeded user ${user.email} (account) with wallet balance ${user.wallet?.balance}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed error', error);
    await prisma.$disconnect();
    process.exit(1);
  });
