export enum WxSubscribeSceneType {
  // 公众号搜索
  ADD_SCENE_SEARCH = 'ADD_SCENE_SEARCH',
  // 公众号迁移
  ADD_SCENE_ACCOUNT_MIGRATION = 'ADD_SCENE_ACCOUNT_MIGRATION',
  // 名片分享
  ADD_SCENE_PROFILE_CARD = 'ADD_SCENE_PROFILE_CARD',
  // 扫描二维码
  ADD_SCENE_QR_CODE = 'ADD_SCENE_QR_CODE',
  // 图文页内名称点击
  ADD_SCENE_PROFILE_LINK = 'ADD_SCENE_PROFILE_LINK',
  // 图文页右上角菜单
  ADD_SCENE_PROFILE_ITEM = 'ADD_SCENE_PROFILE_ITEM',
  // 支付后关注
  ADD_SCENE_PAID = 'ADD_SCENE_PAID',
  // 其他
  ADD_SCENE_OTHERS = 'ADD_SCENE_OTHERS',
}

/*
{
    "phoneNumber": "13580006666",
    "purePhoneNumber": "13580006666",
    "countryCode": "86",
    "watermark":
    {
        "appid":"APPID",
        "timestamp": TIMESTAMP
    }
}
 */
export type GetPhoneNumber = {
  // 用户绑定的手机号（国外手机号会有区号）
  phoneNumber: string;
  // 没有区号的手机号
  purePhoneNumber: string;
  // 区号
  countryCode: string;
};

export interface WxAccessToken {
  access_token: string;
  expires_in: number;
  errcode?: string;
  errmsg?: string;
}

export enum WxCodeSessionErrCode {
  Busy = -1,
  Success,
  Invalid = 40029,
  Rate100Limit = 45011,
}

export interface WxCodeSession {
  // 用户唯一标识
  openid: string;
  // 会话密钥
  session_key: string;
  // 用户在开放平台的唯一标识符，在满足 UnionID 下发条件的情况下会返回，详见 UnionID 机制说明。
  unionid: string;
  /**
   * 错误码
   * -1  系统繁忙，此时请开发者稍候再试
   * 0  请求成功
   * 40029  code 无效
   * 45011  频率限制，每个用户每分钟100次
   */
  errcode: WxCodeSessionErrCode;
  // 错误信息
  errmsg: string;
}

export interface WxQrTicketInfo {
  // 获取的二维码ticket，凭借此ticket可以在有效时间内换取二维码。
  ticket: string;
  // 该二维码有效时间，以秒为单位。 最大不超过2592000（即30天）。
  expire_seconds: number;
  // 二维码图片解析后的地址，开发者可根据该地址自行生成需要的二维码图片
  url: string;
}

export interface WxSendTemplateInfo {
  errcode: number;
  errmsg: string;
  msgid: number;
}

export type TemplateData = {
  first: {
    value: string;
    color: string;
  };
  keyword1?: {
    value: string;
    color: string;
  };
  keyword2?: {
    value: string;
    color: string;
  };
  keyword3?: {
    value: string;
    color: string;
  };
  keyword4?: {
    value: string;
    color: string;
  };
  remark?: {
    value: string;
    color: string;
  };
};

export type MiniSubscribeData = {
  phrase1?: {
    value: string;
  };
  thing1?: {
    value: string;
  };
  thing2?: {
    value: string;
  };
  thing3?: {
    value: string;
  };
  thing4?: {
    value: string;
  };
  thing5?: {
    value: string;
  };
  thing6?: {
    value: string;
  };
  thing7?: {
    value: string;
  };
  date3?: {
    value: string;
  };
};

export type SubscribeMessageInfo = {
  // 错误码   0 是正常
  // 40003 touser字段openid为空或者不正确
  // 40037 订阅模板id为空不正确
  // 43101 用户拒绝接受消息，如果用户之前曾经订阅过，则表示用户取消了订阅关系
  // 47003 模板参数不准确，可能为空或者不满足规则，errmsg会提示具体是哪个字段出错
  // 41030 page路径不正确，需要保证在现网版本小程序中存在，与app.json保持一致
  errcode: number;
  // 错误信息
  errmsg: string;
};
