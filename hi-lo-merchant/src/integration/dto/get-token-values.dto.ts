import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GetTokenValuesDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class GetTokenValuesResponseData {
  tokenValues: number[];
}
