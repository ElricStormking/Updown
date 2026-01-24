import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class LaunchGameDto {
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

export class LaunchGameResponseData {
  url: string;
}
