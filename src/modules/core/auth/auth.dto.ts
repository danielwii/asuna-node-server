import { ApiModelProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import * as _ from 'lodash';

export class ResetPasswordDto {
  @ApiModelProperty({ type: 'username' })
  @IsString()
  @Transform(value => _.trim(value))
  readonly username: string;

  @ApiModelProperty({ type: 'email' })
  @IsEmail()
  @Transform(value => (value ? _.trim(value) : null))
  @IsOptional()
  readonly email: string;

  @ApiModelProperty({ minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  readonly password: string;
}

/**
 * for admin auth currently
 */
export class SignDto {
  @ApiModelProperty({ type: 'email' })
  @IsString()
  @Transform(value => _.trim(value))
  @IsNotEmpty()
  readonly email: string;

  @ApiModelProperty()
  @IsNotEmpty()
  readonly password: string;
}

export class SignInDto {
  @IsString()
  @Transform(value => _.trim(value))
  @IsNotEmpty()
  readonly username: string;

  @IsNotEmpty()
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
  @Expose({ name: 'with-secret-key', toPlainOnly: true })
  @Transform(value => !!value, { toPlainOnly: true })
  readonly password: string;
}
