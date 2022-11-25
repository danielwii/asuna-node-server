import { Body, Controller, Logger, Param, Post, Put, Req, UseGuards } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import _ from 'lodash';

import { AppDataSource } from '../../datasource';
import { JwtAuthGuard, JwtAuthRequest, JwtAuthRequestExtractor } from '../auth';
import { UserHelper } from '../user.helper';
import { UserRelation, UserRelationType } from './friends.entities';
import { fileURLToPath } from "url";

export class UserFollowDto {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  type: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  refId: string;
}

export class UserUnfollowDto extends UserFollowDto {}

class UserRelationRequestDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) => _.trim(value))
  message?: string;
}

@Controller('api/v1/interaction')
export class InteractionController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), InteractionController.name));

  @UseGuards(new JwtAuthGuard())
  @Post('follow')
  async follow(@Body() body: UserFollowDto, @Req() req: JwtAuthRequest): Promise<void> {
    const authInfo = JwtAuthRequestExtractor.of(req);
    this.logger.debug(`follow ${r({ authInfo, body })}`);
    await UserHelper.follow(authInfo.profile, body.type, body.refId);
  }

  @UseGuards(new JwtAuthGuard())
  @Post('unfollow')
  async unfollow(@Body() body: UserUnfollowDto, @Req() req: JwtAuthRequest): Promise<void> {
    const authInfo = JwtAuthRequestExtractor.of(req);
    this.logger.debug(`unfollow ${r({ authInfo, body })}`);
    await UserHelper.unfollow(authInfo.profile, body.type, body.refId);
  }

  @UseGuards(new JwtAuthGuard())
  @Post(':id/request')
  async request(@Param('id') profileId: string, @Body() dto: UserRelationRequestDto, @Req() req: JwtAuthRequest) {
    const { payload } = req;
    if (profileId === payload.id) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, '无法添加自己为好友');
    }
    const exists = await UserRelation.findOneBy({ profileId, requesterId: payload.id });
    this.logger.log(`request relation ${r({ profileId, payload, dto, relation: exists })}`);
    if (!exists) {
      return UserRelation.of({ profileId, requesterId: payload.id, message: dto.message }).save();
    }
    if (exists.type === UserRelationType.ignored) {
      exists.type = UserRelationType.request;
      await exists.save();
    } else if (exists.type === UserRelationType.blocked) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, '您已被屏蔽');
    }

    return ApiResponse.success();
  }

  @UseGuards(new JwtAuthGuard())
  @Put(':id/accept')
  async accept(@Param('id') relationId: string, @Req() req: JwtAuthRequest) {
    const { payload } = req;
    const relation = await UserRelation.findOneBy({ id: relationId, profileId: payload.id });
    if (!relation) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, '无效的申请');
    }

    await AppDataSource.dataSource.transaction(async (entityManager) => {
      relation.type = UserRelationType.accepted;
      await entityManager.save(relation);
      // 需要增加一个双向 id
      const reverse = await UserRelation.findOneBy({
        profileId: relation.requesterId,
        requesterId: relation.profileId,
      });
      if (reverse) {
        if (reverse.type === UserRelationType.blocked) {
          throw new AsunaException(AsunaErrorCode.Unprocessable, '无法添加对方为好友');
        }
        reverse.type = UserRelationType.accepted;
        await entityManager.save(reverse);
      } else {
        await entityManager.save(
          UserRelation.of({
            profileId: relation.requesterId,
            requesterId: relation.profileId,
            type: UserRelationType.accepted,
          }),
        );
      }
    });

    return ApiResponse.success();
  }

  @UseGuards(new JwtAuthGuard())
  @Put(':id/ignore')
  async ignore(@Param('id') relationId: string, @Req() req: JwtAuthRequest) {
    const { payload } = req;
    const relation = await UserRelation.findOneBy({ id: relationId, profileId: payload.id });
    if (!relation) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, '无效的申请');
    }
    relation.type = UserRelationType.ignored;
    await relation.save();
    return ApiResponse.success();
  }

  // TODO block 的 user.profileId 是 requester，发起者是自己也就是 UserRelation 的 profileId
  @UseGuards(new JwtAuthGuard())
  @Put(':id/block')
  async block(@Param('id') profileId: string, @Req() req: JwtAuthRequest) {
    const { payload } = req;
    const relation = await UserRelation.findOneBy({ profileId, requesterId: payload.id });
    if (!relation) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, '无法找到好友');
    }
    relation.type = UserRelationType.blocked;
    await relation.save();
    return ApiResponse.success();
  }

  // TODO
  @UseGuards(new JwtAuthGuard())
  @Put(':id/unblock')
  async unblock(@Param('id') profileId: string, @Req() req: JwtAuthRequest) {
    const { payload } = req;
    const relation = await UserRelation.findOneBy({ profileId, requesterId: payload.id });
    if (!relation) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, '无法找到好友');
    }
    relation.type = UserRelationType.accepted;
    await relation.save();
    return ApiResponse.success();
  }
}
