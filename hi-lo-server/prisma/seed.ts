import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedTestMerchant() {
  const merchantId = process.env.SEED_MERCHANT_ID ?? 'TEST_MERCHANT';
  const merchantName = process.env.SEED_MERCHANT_NAME ?? 'Test Casino';
  const hashKey = process.env.SEED_MERCHANT_HASH_KEY ?? 'dGVzdGhhc2hrZXkxMjM0NTY3ODkwYWI=';

  const merchant = await prisma.merchant.upsert({
    where: { merchantId },
    update: {
      name: merchantName,
      hashKey,
    },
    create: {
      merchantId,
      name: merchantName,
      hashKey,
      isActive: true,
    },
  });

  console.log(
    `✅ Seeded merchant ${merchant.merchantId} (${merchant.name})`,
  );
  console.log(`   Hash Key: ${merchant.hashKey}`);

  return merchant;
}

async function seedDemoUser() {
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
      email: account,
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

  return user;
}

async function seedAdminUser() {
  const account = process.env.SEED_ADMIN_ACCOUNT ?? 'design';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'design1234';
  const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS ?? 12);

  const passwordHash = await bcrypt.hash(password, saltRounds);

  const user = await prisma.user.upsert({
    where: { email: account },
    update: {
      password: passwordHash,
    },
    create: {
      email: account,
      password: passwordHash,
      wallet: {
        create: {
          balance: new Prisma.Decimal(0),
          currency: 'USDT',
        },
      },
    },
  });

  console.log(`✅ Seeded admin user ${user.email}`);

  return user;
}

async function main() {
  await seedTestMerchant();
  await seedDemoUser();
  await seedAdminUser();
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
