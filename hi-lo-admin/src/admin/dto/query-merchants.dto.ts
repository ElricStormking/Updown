import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from './pagination.dto';

export class QueryMerchantsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMerchantDto {
  @IsString()
  @MinLength(1)
  merchantId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(8)
  hashKey: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  callbackEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  loginPlayerCallbackUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  updateBalanceCallbackUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  integrationAllowedIps?: string[];
}

export class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  hashKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  callbackEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  loginPlayerCallbackUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  updateBalanceCallbackUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  integrationAllowedIps?: string[];
}

export interface MerchantResponseItem {
  id: string;
  merchantId: string;
  name: string;
  hashKeyMasked: string;
  currency: string;
  callbackEnabled: boolean;
  loginPlayerCallbackUrl: string | null;
  updateBalanceCallbackUrl: string | null;
  integrationAllowedIps: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
