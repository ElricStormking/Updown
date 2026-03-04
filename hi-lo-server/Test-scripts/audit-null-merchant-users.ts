import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const formatDate = (value: Date) => value.toISOString();

type AuditUserRow = {
  id: string;
  email: string;
  merchantId: string | null;
  merchantAccount: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const printRow = (value: AuditUserRow) => {
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
  const users = await prisma.$queryRaw<AuditUserRow[]>`
    SELECT
      "id",
      "email",
      "merchantId",
      "merchantAccount",
      "status",
      "createdAt",
      "updatedAt"
    FROM "User"
    WHERE "merchantId" IS NULL OR "merchantId" = ''
    ORDER BY "createdAt" ASC
  `;

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
