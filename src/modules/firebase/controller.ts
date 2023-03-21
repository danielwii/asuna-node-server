import { Body, Controller, Get, HttpCode, Logger, Post, Query } from '@nestjs/common';

import { UnprocessableException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IsEnum, IsOptional, IsString } from 'class-validator';
import admin from 'firebase-admin';
import fs from 'fs-extra';
import _ from 'lodash';

import { FirebaseConfigure } from './configure';
import { named } from "../helper";

enum SignInType {
  email = 'email',
}

class SignInQuery {
  @IsEnum(SignInType) @IsOptional() via?: SignInType;
}

class SignInDTO {
  @IsString() @IsOptional() email?: string;
}

@Controller('__')
export class FirebaseController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));


  /*  @Post()
  @named
  public async test(@Body() dto: UpsertReminderDTO, funcName?: string): Promise<ApiResponse>> {
    this.logger.log(`${funcName}: ${r({ dto })}`);
    return ApiResponse.success();
  }*/

  /*  @Post('user')
  @named
  public async createUser(@Body() dto, funcName?: string): Promise<ApiResponse>> {
    this.logger.log(`${funcName}: ${r({ dto })}`);
    const data = await admin.auth().createUser({
      email: 'danielwii0326@gmail.com',
      emailVerified: false,
      displayName: 'Daniel Wei',
    });
    return ApiResponse.success(data);
  }*/

  @Post('auth/user')
  @named
  public async authUser(@Body() dto, funcName?: string): Promise<ApiResponse> {
    this.logger.log(`${funcName}: ${r({ dto })}`);
    const user = await admin.auth().getUserByEmail(dto.email);
    const signInLink = await admin.auth().generateSignInWithEmailLink(dto.email, {
      url: 'https://reminder.jp.ngrok.io/__/user/email/sign-in',
      handleCodeInApp: true,
      iOS: {
        bundleId: 'com.example.ios',
      },
      android: {
        packageName: 'com.example.android',
        installApp: true,
        minimumVersion: '12',
      },
      dynamicLinkDomain: 'test.api.moment-minder.com',
    });

    /*
    const verificationLink = await admin.auth().generateEmailVerificationLink(dto.email, {
      url: 'https://reminder.jp.ngrok.io/__/user/email/verify',
      dynamicLinkDomain: 'test.api.moment-minder.com',
      // handleCodeInApp: true,
    });*/
    return ApiResponse.success({ user, /*verificationLink,*/ signInLink });
  }

  @Get('user')
  @named
  public async getUser(@Query() query, @Body() dto, funcName?: string): Promise<ApiResponse> {
    this.logger.log(`${funcName}: ${r({ query, dto })}`);
    const user = await admin.auth().getUserByEmail(query.email);
    return ApiResponse.success({ user, values: _.values(SignInType), query, dto });
  }

  @Post('auth/sign-in')
  @HttpCode(200)
  @named
  public async signIn(@Query() query: SignInQuery, @Body() body: SignInDTO, funcName?: string): Promise<ApiResponse> {
    this.logger.log(`${funcName}: ${r({ query, body })}`);
    switch (query.via) {
      case SignInType.email: {
        try {
          const user = await admin.auth().getUserByEmail(body.email!);
          return ApiResponse.success({ user, query, body });
        } catch (e) {
          if (e.code === 'auth/user-not-found') {
            this.logger.warn(`user not found: ${r(body)}`);
            throw UnprocessableException.of('user not found, please sign up first');
          }
          this.logger.error(`failed to get user by email: ${r(body)} with error: ${r(e)}`);
          throw UnprocessableException.of('failed to get user');
        }
      }
    }
  }

  @Post('auth/email/sign-up')
  @named
  public async signUpViaEmail(@Query() query, @Body() body, funcName?: string): Promise<ApiResponse> {
    this.logger.log(`${funcName}: ${r({ query, body })}`);
    const user = await admin
      .auth()
      .getUserByEmail(body.email)
      .catch(async (err) => {
        if (err.code === 'auth/user-not-found') {
          this.logger.warn(`user not found: ${r(body)}, create new user`);
          const created = await admin.auth().createUser({
            email: body.email,
            emailVerified: false,
            // displayName: dto.displayName,
          });
          this.logger.log(`created user: ${r(created)} for ${r(body)}`);

          /// send verify email
          const verificationLink = await admin.auth().generateEmailVerificationLink(body.email, {
            url: 'https://reminder.jp.ngrok.io/__/user/email/verify',
            dynamicLinkDomain: 'test.api.moment-minder.com',
            handleCodeInApp: true,
            iOS: {
              bundleId: 'com.example.ios',
            },
            android: {
              packageName: 'com.example.android',
              installApp: true,
              minimumVersion: '12',
            },
          });
          return null;
        }
      });
    if (!user) {
      // send verify email
    }
    this.logger.log(`user: ${r(user)}`);
    return ApiResponse.success();
  }

  @Post('auth/email/verify')
  @named
  public async verifyEmail(@Query() query, @Body() dto, funcName?: string): Promise<ApiResponse> {
    this.logger.log(`${funcName}: ${r({ query, dto })}`);
    return ApiResponse.success();
  }
}
