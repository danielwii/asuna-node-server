import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';

import { RestCrudController } from '../core/base/base.controllers';

@ApiUseTags('sys-admin')
@Controller('admin/rest/app')
export class AppRestController extends RestCrudController {
  constructor() {
    super('app');
  }
}
