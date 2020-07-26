import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RestCrudController } from './base.controllers';

@ApiTags('sys-admin')
@Controller('admin/rest/admin')
export class AdminRestController extends RestCrudController {
  constructor() {
    super('admin');
  }
}

@ApiTags('sys-admin')
@Controller('admin/rest/app')
export class AdminAppRestController extends RestCrudController {
  constructor() {
    super('app');
  }
}

@ApiTags('sys-admin')
@Controller('admin/rest/content')
export class AdminContentRestController extends RestCrudController {
  constructor() {
    super('content');
  }
}

@ApiTags('sys-admin')
@Controller('admin/rest/sys')
export class AdminSysRestController extends RestCrudController {
  constructor() {
    super('sys');
  }
}

// TODO admin 后的 module 路由应该可以自动化
@ApiTags('sys-admin')
@Controller('admin/rest/wx')
export class AdminWxRestController extends RestCrudController {
  constructor() {
    super('wx');
  }
}

@Controller('admin/rest/payment')
export class AdminPaymentRestController extends RestCrudController {
  constructor() {
    super('payment');
  }
}

@Controller('admin/rest/auth')
export class AdminAuthRestController extends RestCrudController {
  constructor() {
    super('auth');
  }
}
