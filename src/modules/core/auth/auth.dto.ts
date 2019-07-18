import { ApiModelProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import * as _ from 'lodash';

export class ResetPasswordDto {
  @ApiModelProperty({ type: 'username' })
  @IsString()
  @Transform(value => _.trim(value))
  readonly username: string;

  @ApiModelProperty({ type: 'email' })
  @IsString()
  @Transform(value => _.trim(value))
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
  @IsString()
  @Transform(value => _.trim(value))
  @IsOptional()
  readonly email: string;

  @IsString()
  @Transform(value => _.trim(value))
  @IsNotEmpty()
  readonly username: string;

  @IsNotEmpty()
  readonly password: string;
}
