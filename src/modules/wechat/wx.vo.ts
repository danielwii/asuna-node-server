import { plainToClass } from 'class-transformer';
import { WeChatUser } from './wechat.entities';
import { WxSubscribeSceneType } from './wx.interfaces';

export class WxUserList {
  total: number;
  count: number;
  data: { openid: string[] };
  next_openid: string;
}

export class WxUserInfo {
  // 用户所在城市
  city: string;
  // 用户所在国家
  country: string;
  // 用户所在的分组ID（兼容旧的用户分组接口）
  groupid: number;
  // 用户头像，最后一个数值代表正方形头像大小（有0、46、64、96、132数值可选，0代表640*640正方形头像），
  // 用户没有头像时该项为空。若用户更换头像，原有头像URL将失效。
  headimgurl: string;
  // 用户的语言，简体中文为zh_CN
  language: string;
  // 用户的昵称
  nickname: string;
  // 用户的标识，对当前公众号唯一
  openid: string;
  // 用户所在省份
  province: string;
  // 二维码扫码场景（开发者自定义）
  qr_scene: number;
  // 二维码扫码场景描述（开发者自定义）
  qr_scene_str: string;
  // 公众号运营者对粉丝的备注，公众号运营者可在微信公众平台用户管理界面对粉丝添加备注
  remark: string;
  // 用户的性别，值为1时是男性，值为2时是女性，值为0时是未知
  sex: number;
  // 用户是否订阅该公众号标识，值为0时，代表此用户没有关注该公众号，拉取不到其余信息。
  subscribe: number;
  // 返回用户关注的渠道来源，
  // ADD_SCENE_SEARCH 公众号搜索，
  // ADD_SCENE_ACCOUNT_MIGRATION 公众号迁移，
  // ADD_SCENE_PROFILE_CARD 名片分享，
  // ADD_SCENE_QR_CODE 扫描二维码，
  // ADD_SCENE_PROFILE_LINK 图文页内名称点击，
  // ADD_SCENE_PROFILE_ITEM 图文页右上角菜单，
  // ADD_SCENE_PAID 支付后关注，
  // ADD_SCENE_OTHERS 其他
  subscribe_scene: WxSubscribeSceneType;
  // 用户关注时间，为时间戳。如果用户曾多次关注，则取最后关注时间
  subscribe_time: number;
  // 用户被打上的标签ID列表
  tagid_list: string[];
  // 只有在用户将公众号绑定到微信开放平台帐号后，才会出现该字段。
  unionid?: string;

  constructor(o: WxUserInfo) {
    Object.assign(this, plainToClass(WxUserInfo, o));
  }

  toWeChatUser(): WeChatUser {
    return new WeChatUser({
      openId: this.openid,
      city: this.city,
      country: this.country,
      groupId: this.groupid,
      headImg: this.headimgurl,
      language: this.language,
      nickname: this.nickname,
      province: this.province,
      qrScene: this.qr_scene,
      qrSceneStr: this.qr_scene_str,
      remark: this.remark,
      sex: this.sex,
      subscribe: this.subscribe,
      subscribeScene: this.subscribe_scene,
      subscribeTime: this.subscribe_time,
      tagIds: this.tagid_list,
      unionId: this.unionid,
    });
  }
}
