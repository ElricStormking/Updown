import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const formatDate = (value: Date) => value.toISOString();

const printRow = (value: {
  id: string;
  email: string;
  merchantId: string | null;
  merchantAccount: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) => {
  console.log(
    [
      value.id,
      value.email,
      value.merchantId ?? '<null>',
      value.merchantAccount ?? '<null>',
      value.status,
      formatDate(value.createdAt),
      formatDate(value.updatedAt),
    ].join('\t'),
  );
};

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ merchantId: null }, { merchantId: '' }],
    },
    select: {
      id: true,
      email: true,
      merchantId: true,
      merchantAccount: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!users.length) {
    console.log('No users found with null/empty merchantId.');
    return;
  }

  console.log(`Found ${users.length} user(s) with null/empty merchantId.`);
  console.log(
    'id\temail\tmerchantId\tmerchantAccount\tstatus\tcreatedAt\tupdatedAt',
  );
  users.forEach(printRow);
  console.log('');
  console.log('Remediation checklist:');
  console.log(
    '1) Assign each account to the correct merchantId and merchantAccount.',
  );
  console.log('2) Or disable accounts that should never access gameplay.');
  console.log(
    '3) Re-run this script until no rows are returned before production rollout.',
  );
}

main()
  .catch((error) => {
    console.error('Null-merchant audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
