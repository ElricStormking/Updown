import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAccountStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  QueryAdminAccountsDto,
  CreateAdminAccountDto,
  UpdateAdminAccountDto,
  QueryLoginRecordsDto,
  AdminAccountResponseItem,
  AdminLoginRecordResponseItem,
} from './dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type AdminAccountScope = {
  adminId: string;
  merchantId: string;
  isSuperAdmin: boolean;
};

const parseDateOnly = (value?: string) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Invalid date format (use YYYY-MM-DD)');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid date value');
  }
  return date;
};

@Injectable()
export class AdminAccountsService {
  private readonly saltRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.saltRounds = Number(
      this.configService.get<number>('auth.saltRounds', { infer: true }) ?? 12,
    );
  }

  async queryAccounts(dto: QueryAdminAccountsDto, scope?: AdminAccountScope) {
    const { page = 0, limit = 20, account, status } = dto;

    const where: Prisma.AdminAccountWhereInput = {};
    if (scope && !scope.isSuperAdmin) {
      where.id = scope.adminId;
    }
    if (account) where.account = { contains: account, mode: 'insensitive' };
    if (status) where.status = status;

    const skip = page * limit;
    const take = limit + 1;

    const accounts = await this.prisma.adminAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const hasNext = accounts.length > limit;
    const items: AdminAccountResponseItem[] = accounts
      .slice(0, limit)
      .map((a) => ({
        id: a.id,
        account: a.account,
        merchantId: a.merchantId,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }));

    return { page, limit, hasNext, items };
  }

  async createAccount(dto: CreateAdminAccountDto) {
    if (dto.isSuperadminCreate && dto.merchantId !== 'hotcoregm') {
      throw new BadRequestException(
        'Superadmin account must use merchantId=hotcoregm',
      );
    }

    const existing = await this.prisma.adminAccount.findUnique({
      where: { account: dto.account },
    });
    if (existing) {
      throw new BadRequestException('Account already exists');
    }
    if (dto.merchantId !== 'hotcoregm') {
      const merchant = await this.prisma.merchant.findUnique({
        where: { merchantId: dto.merchantId },
      });
      if (!merchant) {
        throw new BadRequestException('Merchant ID not found');
      }
    }
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const account = await this.prisma.adminAccount.create({
      data: {
        account: dto.account,
        password: passwordHash,
        status: dto.status ?? AdminAccountStatus.ENABLED,
        merchantId: dto.merchantId,
      },
    });
    return {
      id: account.id,
      account: account.account,
      merchantId: account.merchantId,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  async hasSuperAdminAccount() {
    const count = await this.prisma.adminAccount.count({
      where: { merchantId: 'hotcoregm' },
    });
    return count > 0;
  }

  async getActiveAccountById(id: string) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id },
    });
    if (!admin || admin.status !== AdminAccountStatus.ENABLED) {
      return null;
    }
    return admin;
  }

  async updateAccount(
    id: string,
    dto: UpdateAdminAccountDto,
    scope?: AdminAccountScope,
  ) {
    const existing = await this.prisma.adminAccount.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Admin account not found');
    }
    if (scope && !scope.isSuperAdmin && id !== scope.adminId) {
      throw new ForbiddenException('Cannot update other admin accounts');
    }
    const data: Prisma.AdminAccountUpdateInput = {};
    if (dto.password !== undefined) {
      data.password = await bcrypt.hash(dto.password, this.saltRounds);
    }
    if (dto.status !== undefined) {
      if (scope && !scope.isSuperAdmin) {
        throw new ForbiddenException('Merchant admin cannot change status');
      }
      data.status = dto.status;
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException('No fields to update');
    }

    const account = await this.prisma.adminAccount.update({
      where: { id },
      data,
    });
    return {
      id: account.id,
      account: account.account,
      merchantId: account.merchantId,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  async deleteAccount(id: string, scope?: AdminAccountScope) {
    if (!scope?.isSuperAdmin) {
      throw new ForbiddenException('Only superadmin can delete admin accounts');
    }

    const existing = await this.prisma.adminAccount.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Admin account not found');
    }
    if (existing.merchantId === 'hotcoregm') {
      throw new BadRequestException(
        'Cannot delete superadmin accounts from this action',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.adminLoginRecord.deleteMany({
        where: { adminId: existing.id },
      });
      await tx.adminAccount.delete({
        where: { id: existing.id },
      });
    });

    return {
      deleted: true,
      id: existing.id,
      account: existing.account,
      merchantId: existing.merchantId,
    };
  }

  async getAccountById(id: string, scope?: AdminAccountScope) {
    if (scope && !scope.isSuperAdmin && id !== scope.adminId) {
      throw new ForbiddenException('Cannot view other admin accounts');
    }
    const account = await this.prisma.adminAccount.findUnique({
      where: { id },
    });
    if (!account) {
      throw new NotFoundException('Admin account not found');
    }
    return {
      id: account.id,
      account: account.account,
      merchantId: account.merchantId,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  async queryLoginRecords(
    dto: QueryLoginRecordsDto,
    scope?: AdminAccountScope,
  ) {
    const { page = 0, limit = 20, start, end, account, result } = dto;
    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    const endExclusive = endDate
      ? new Date(endDate.getTime() + MS_PER_DAY)
      : null;

    const where: Prisma.AdminLoginRecordWhereInput = {};
    if (startDate || endExclusive) {
      where.loginTime = {};
      if (startDate) where.loginTime.gte = startDate;
      if (endExclusive) where.loginTime.lt = endExclusive;
    }
    if (account) {
      where.admin = { account: { contains: account, mode: 'insensitive' } };
    }
    if (result !== undefined) {
      where.result = result === 'true' || result === '1';
    }
    if (scope && !scope.isSuperAdmin) {
      where.adminId = scope.adminId;
    }

    const skip = page * limit;
    const take = limit + 1;

    const records = await this.prisma.adminLoginRecord.findMany({
      where,
      include: { admin: { select: { account: true } } },
      orderBy: { loginTime: 'desc' },
      skip,
      take,
    });

    const hasNext = records.length > limit;
    const items: AdminLoginRecordResponseItem[] = records
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        account: r.admin.account,
        result: r.result,
        failureReason: r.failureReason,
        loginTime: r.loginTime.toISOString(),
      }));

    return { page, limit, hasNext, items };
  }

  async recordLogin(
    accountName: string,
    success: boolean,
    failureReason?: string,
  ) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { account: accountName },
    });
    if (!admin) return;

    await this.prisma.adminLoginRecord.create({
      data: {
        adminId: admin.id,
        result: success,
        failureReason: success ? null : failureReason,
      },
    });
  }

  async validateAdminLogin(accountName: string, password: string) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { account: accountName },
    });

    if (!admin) {
      await this.recordLogin(accountName, false, 'Account not found');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.status !== AdminAccountStatus.ENABLED) {
      await this.recordLogin(
        accountName,
        false,
        `Account ${admin.status.toLowerCase()}`,
      );
      throw new UnauthorizedException(
        `Account is ${admin.status.toLowerCase()}`,
      );
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      await this.recordLogin(accountName, false, 'Invalid password');
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.recordLogin(accountName, true);
    return admin;
  }
}
