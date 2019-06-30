import { Controller } from '@nestjs/common';

import { RestCrudController } from '../core/base/base.controllers';

@Controller('admin/rest/app')
export class AppRestController extends RestCrudController {
  constructor() {
    super('app');
  }
}
