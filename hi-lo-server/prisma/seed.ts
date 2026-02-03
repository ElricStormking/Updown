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

async function seedQaAdminAccount() {
  const account = 'qamerchant';
  const password = 'qa1234';
  const merchantId = 'qamerchant1';
  const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS ?? 12);

  await prisma.merchant.upsert({
    where: { merchantId },
    update: { isActive: true },
    create: {
      merchantId,
      name: 'QA Merchant',
      hashKey: 'cWFtZXJjaGFudDE=',
      isActive: true,
    },
  });

  const passwordHash = await bcrypt.hash(password, saltRounds);
  const admin = await prisma.adminAccount.upsert({
    where: { account },
    update: {
      password: passwordHash,
      status: 'ENABLED',
      merchantId,
    },
    create: {
      account,
      password: passwordHash,
      status: 'ENABLED',
      merchantId,
    },
  });

  console.log(`✅ Seeded admin account ${admin.account} (${admin.merchantId})`);
  return admin;
}

async function seedTestPlayerTopUp() {
  const account = process.env.SEED_TESTPLAYER_ACCOUNT ?? 'testplayer';
  const password = process.env.SEED_TESTPLAYER_PASSWORD ?? 'changeme';
  const saltRounds = Number(process.env.PASSWORD_SALT_ROUNDS ?? 12);
  const topUpAmount = new Prisma.Decimal(process.env.SEED_TESTPLAYER_TOPUP ?? '1000000');

  const existing = await prisma.user.findUnique({
    where: { email: account },
    include: { wallet: true },
  });

  if (existing) {
    if (existing.wallet) {
      const updatedWallet = await prisma.wallet.update({
        where: { userId: existing.id },
        data: { balance: { increment: topUpAmount } },
      });
      console.log(
        `✅ Topped up ${existing.email} by ${topUpAmount} (new balance ${updatedWallet.balance})`,
      );
      return existing;
    }

    await prisma.wallet.create({
      data: {
        userId: existing.id,
        balance: topUpAmount,
        currency: 'USDT',
      },
    });
    console.log(`✅ Created wallet for ${existing.email} with ${topUpAmount}`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, saltRounds);
  const user = await prisma.user.create({
    data: {
      email: account,
      password: passwordHash,
      wallet: {
        create: {
          balance: topUpAmount,
          currency: 'USDT',
        },
      },
    },
  });
  console.log(`✅ Created ${user.email} with wallet balance ${topUpAmount}`);
  return user;
}

async function main() {
  await seedTestMerchant();
  await seedDemoUser();
  await seedAdminUser();
  await seedQaAdminAccount();
  await seedTestPlayerTopUp();
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
