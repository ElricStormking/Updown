import { IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  account!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
