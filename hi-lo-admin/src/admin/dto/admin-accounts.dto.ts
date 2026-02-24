import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AdminAccountStatus } from '@prisma/client';
import { DateRangeQueryDto, PaginationQueryDto } from './pagination.dto';

export class QueryAdminAccountsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsEnum(AdminAccountStatus)
  status?: AdminAccountStatus;
}

export class CreateAdminAccountDto {
  @IsString()
  @MinLength(3)
  account: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(3)
  merchantId: string;

  @IsOptional()
  @IsEnum(AdminAccountStatus)
  status?: AdminAccountStatus;

  @IsOptional()
  @IsBoolean()
  isSuperadminCreate?: boolean;
}

export class UpdateAdminAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  account?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  merchantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(AdminAccountStatus)
  status?: AdminAccountStatus;
}

export class QueryLoginRecordsDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsString()
  result?: string;
}

export interface AdminAccountResponseItem {
  id: string;
  account: string;
  merchantId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLoginRecordResponseItem {
  id: string;
  account: string;
  result: boolean;
  failureReason: string | null;
  loginTime: string;
}
