import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AccountCreateDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  account: string;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}
