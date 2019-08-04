```
type College {}
# 包含自定义参数的时候包装为 mixed 类型
type MixedCollege { origin: College, liked: Boolean }

# 非分页 api
colleges(query: QueryCondition!): [College]
-> api_collages

# 分页 api，默认 queryCondition
paged_colleges(query: QueryCondition!): PagedCollege
-> api_paged_colleges

# 自定义分页 api，包含自定义查询参数
paged_colleges(type: Education, pageRequest: PageRequest, isFeatured: Boolean): PagedCollege
-> search_paged_collages

# 查询单个实体
college(id: Int!): College
-> api_college
```
