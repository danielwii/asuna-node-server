type AnyJson = boolean | number | string | null | JsonArray | JsonMap;
export interface JsonMap {
  [key: string]: AnyJson;
}
export interface JsonArray extends Array<AnyJson> {}
export type Json = JsonMap | JsonArray;

export type EntityMetaInfoOptions = {
  /**
   * ServerSide: 用于外键关联的识别名称
   */
  name: string;
  /**
   * 用于声明 STI 的类型信息
   */
  sti?: {
    name: string;
    info: STIMetaInfoOptions;
  };
};

export interface MetaInfoBaseOptions {
  /**
   * 在 schema 中隐藏
   */
  ignore?: boolean;
  /**
   * readable 的名称
   */
  name?: string;
  /**
   * 修正前端更新数据的引用，`model_id` -> `model`
   * @deprecated 当更新字段和 schema 字段一致时无需设置，在当前框架中应该无需使用
   */
  ref?: string;
  /**
   * upsert 时会进行提示
   */
  help?: string;
  /**
   * readonly - 标记该列只读
   * hidden - 标记该列隐藏，作用于关联字段时同时也不应拉取该列对应的关联数据
   */
  accessible?: 'readonly' | 'hidden';
  /**
   * 标记该字段是一个 json，但是返回的是 string，需要 client 自行处理
   */
  json?: 'str';
  /**
   * 默认值
   */
  defaultValue?: any;
}

export interface NormalMetaInfoOptions extends MetaInfoBaseOptions {
  type?:
    | 'Image'
    | 'Images'
    | 'Video'
    | 'Videos'
    | 'Authorities'
    | 'RichText'
    | 'Deletable'
    | 'SortPosition'
    | 'Enum'
    | 'Tree'
    /**
     * 包含浮动标签信息的图片
     */
    | 'RichImage';
}

/**
 * RichText - 富文本
 * Deletable - 放置在一个 boolean 状态上，标记记录是否可删除
 * SortPosition - 临时存放排序序列 TODO 需要考虑更通用的排序方案
 * EnumFilter - 目前有两个用途，根据 `enumData` 获的要筛选数据
 *   1 - 用于筛选不同类型的数据关联时使用
 *     e.g @MetaInfo({
 *           name      : '类型',
 *           type      : 'EnumFilter',
 *           filterType: 'sort',
 *           enumData  : SortType,
 *         })
 *         @IsIn(_.keys(SortType))
 *   2 - 用于下拉菜单
 *     e.g @MetaInfo({
 *           name    : '位置',
 *           type    : 'EnumFilter',
 *           enumData: LocationType,
 *         })
 *         @IsOptional() // 可接受 null
 *         @IsIn(_.keys(LocationType))
 *         @Column('varchar', { nullable: true, name: 'location_type' })
 *         locationType: typeof LocationType;
 */
export interface EnumFilterMetaInfoOptions extends MetaInfoBaseOptions {
  type: 'EnumFilter';
  filterType?: 'Sort';
  enumData: { [key: string]: string | object };
}

export interface JSONMetaInfoOptions extends MetaInfoBaseOptions {
  type: 'SimpleJSON';
  jsonType: 'string-array' | 'any';
}

export interface EnumMetaInfoOptions extends MetaInfoBaseOptions {
  type: 'Enum';
  enumData: { [key: string]: string | object };
}

export interface STIMetaInfoOptions extends MetaInfoBaseOptions {
  type: 'EnumFilter';
  /**
   * 使用继承类时该字段应该是只读的
   */
  accessible: 'readonly' | 'hidden';
  enumData?: { [key: string]: string | object };
  defaultValue?: string;
}

export type MetaInfoOptions =
  | NormalMetaInfoOptions
  | EnumFilterMetaInfoOptions
  | EnumMetaInfoOptions
  | JSONMetaInfoOptions;

/**
 * 为对象附加 `info` 信息
 * @param options
 * @returns {Function}
 * @constructor
 */
export function MetaInfo(options: MetaInfoOptions): Function {
  return function(target, propertyKey: string, descriptor: PropertyDescriptor) {
    target.info = { ...target.info, [propertyKey]: options };
  };
}

export function EntityMetaInfo(options: EntityMetaInfoOptions): Function {
  return function(target, propertyKey: string, descriptor: PropertyDescriptor) {
    target.entityInfo = options;
  };
}

// --------------------------------------------------------------
// Conditions
// --------------------------------------------------------------

type AndCondition = { $and: Condition };
type OrCondition = { $or: Condition };
type LikeCondition = { $like: string };
type NotLikeCondition = { $notLike: string };
type AnyCondition = { $any: any[] };
type InCondition = { $in: any[] };
type NotInCondition = { $notIn: any[] };
type BetweenCondition = { $between: [any, any] };
type EqualCondition = { $eq: any };
type LessThanCondition = { $lt: any };
type GreatThanCondition = { $gt: any };
type RawCondition = { $raw: any };
type NotNullCondition = { $notNull: true };
type IsNullCondition = { $isNull: true };
type NotCondition = { $not: any };

export type Condition = Partial<
  AndCondition &
    LikeCondition &
    OrCondition &
    NotLikeCondition &
    AnyCondition &
    InCondition &
    NotInCondition &
    BetweenCondition &
    EqualCondition &
    LessThanCondition &
    GreatThanCondition &
    RawCondition &
    NotNullCondition &
    IsNullCondition &
    NotCondition
>;

export type WhereConditions = Record<string, Condition>;
