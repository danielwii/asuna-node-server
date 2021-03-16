[![travis-ci](https://travis-ci.org/danielwii/asuna-node-server.svg?branch=master)](https://travis-ci.org/danielwii/asuna-node-server)
[![codecov](https://codecov.io/gh/danielwii/asuna-node-server/branch/master/graph/badge.svg)](https://codecov.io/gh/danielwii/asuna-node-server)
[![Maintainability](https://api.codeclimate.com/v1/badges/7f78db8355785dfe34a4/maintainability)](https://codeclimate.com/github/danielwii/asuna-node-server/maintainability)
[![Dependencies](https://img.shields.io/david/danielwii/asuna-node-server.svg?style=flat-square)](https://david-dm.org/danielwii/asuna-node-server)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)


### quickstart

`ENV=dev yarn dev` or `ENV=dev yarn dev:watch`

### Security

Node.js 安全核对表: https://blog.risingstack.com/node-js-security-checklist/

* 实施速率限制，防止针对认证的暴力攻击。实现这一点的一种方式是使用 StrongLoop API 来强制实施速率限制策略。或者，可以使用诸如 express-limiter 的中间件，但是这样做需要对代码作些修改。
* 使用 csurf 中间件来防御跨站点请求伪造 (CSRF)。
* 始终过滤和净化用户输入，防御跨站点脚本编制 (XSS) 和命令注入攻击。
* 使用参数化查询或预编译的语句来防御 SQL 注入攻击。
* 使用开源的 sqlmap 工具来检测应用程序中的 SQL 注入漏洞。 
* 使用 nmap 和 sslyze 工具来测试 SSL 密码、密钥和重新协商的配置以及证书的有效性。
* 使用 safe-regex 来确保正则表达式不易受到正则表达式拒绝服务攻击。
