import { IsString } from 'class-validator';

export class ClientReadyDto {
  @IsString()
  token!: string;
}
