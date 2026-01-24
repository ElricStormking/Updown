import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
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
  @IsBoolean()
  isActive?: boolean;
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
}

export interface MerchantResponseItem {
  id: string;
  merchantId: string;
  name: string;
  hashKeyMasked: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
