import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
} from 'class-validator';

export class UpdateTokenValuesDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @IsNumber({}, { each: true })
  tokenValues: number[];

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class UpdateTokenValuesResponseData {
  tokenValues: number[];
}
