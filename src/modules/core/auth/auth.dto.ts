import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import * as _ from 'lodash';

export class ResetPasswordDto {
  @ApiProperty({ type: 'username' })
  @IsString()
  @Transform(value => _.trim(value))
  readonly username: string;

  @ApiProperty({ type: 'email' })
  @IsEmail()
  @Transform(value => (value ? _.trim(value) : null))
  @IsOptional()
  readonly email?: string;

  @ApiProperty({ minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  readonly password: string;
}

/**
 * for admin auth currently
 */
export class SignDto {
  @ApiProperty({ type: 'email' })
  @IsString()
  @Transform(value => _.trim(value))
  @IsNotEmpty()
  readonly email: string;

  @ApiProperty()
  @IsNotEmpty()
  readonly password: string;
}

export class SignInDto {
  @IsString()
  @Transform(value => _.trim(value))
  @IsNotEmpty()
  readonly username: string;

  @IsNotEmpty()
  @Exclude({ toPlainOnly: true })
  readonly password: string;
}

export class SignUpDto {
  @IsEmail()
  @Transform(value => (value ? _.trim(value) : null))
  @IsOptional()
  readonly email?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(value => _.trim(value))
  readonly username: string;

  @IsNotEmpty()
  @Exclude({ toPlainOnly: true })
  // @Expose({ name: 'with-password', toPlainOnly: true })
  // @Transform(value => !!value, { toPlainOnly: true })
  readonly password: string;
}
