import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiModelProperty({ type: 'username' })
  readonly username: string;

  @ApiModelProperty({ type: 'email' })
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
  @IsNotEmpty()
  readonly email: string;

  @ApiModelProperty()
  @IsNotEmpty()
  readonly password: string;
}

export class SignInDto {
  @IsNotEmpty()
  readonly username: string;

  @IsNotEmpty()
  readonly password: string;
}

export class SignUpDto {
  readonly email: string;
  @IsNotEmpty()
  readonly username: string;
  @IsNotEmpty()
  readonly password: string;
}
