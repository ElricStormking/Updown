import { IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @MinLength(3)
  account: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class AdminRegisterDto {
  @IsString()
  @MinLength(3)
  account: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(3)
  merchantId: string;
}
