import { ApiProperty } from '@nestjs/swagger';

import { Exclude, Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import _ from 'lodash';

export class AdminResetPasswordDTO {
  @ApiProperty({ type: 'username' })
  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly username: string;

  @ApiProperty({ type: 'email' })
  @IsEmail()
  @Transform(({ value }) => (value ? _.trim(value) : undefined))
  @IsOptional()
  readonly email?: string;

  @ApiProperty({ minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  readonly password: string;
}

export class ResetPasswordDTO {
  @ApiProperty({ minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  readonly password: string;
}

export class UpdateProfileDTO {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @IsOptional()
  @MinLength(1)
  readonly nickname?: string;

  @IsObject()
  @IsOptional()
  readonly position?: JSON;
}

export class ResetAccountDTO {
  @ApiProperty({ type: 'username' })
  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly username: string;

  @ApiProperty({ type: 'email' })
  @IsEmail()
  @Transform(({ value }) => (value ? _.trim(value) : undefined))
  @IsOptional()
  readonly email?: string;
}

/**
 * for admin auth currently
 */
export class SignDTO {
  @ApiProperty({ type: 'email' })
  @ValidateIf((o) => _.isEmpty(o.username))
  @IsString()
  @Transform(({ value }) => _.trim(value))
  @IsNotEmpty()
  readonly email: string;

  @ApiProperty({ type: 'username' })
  @ValidateIf((o) => _.isEmpty(o.email))
  @IsString()
  @Transform(({ value }) => _.trim(value))
  @IsNotEmpty()
  readonly username: string;

  @ApiProperty()
  @IsNotEmpty()
  readonly password: string;
}

export class SignInDTO {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  @IsNotEmpty()
  readonly username: string;

  @IsNotEmpty()
  @Exclude({ toPlainOnly: true })
  readonly password: string;
}

export class SignUpDTO {
  @IsEmail()
  @Transform(({ value }) => (value ? _.trim(value) : undefined))
  @IsOptional()
  readonly email?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => _.trim(value))
  readonly username: string;

  @IsNotEmpty()
  @Exclude({ toPlainOnly: true })
  // @Expose({ name: 'with-password', toPlainOnly: true })
  // @Transform(value => !!value, { toPlainOnly: true })
  readonly password: string;
}
