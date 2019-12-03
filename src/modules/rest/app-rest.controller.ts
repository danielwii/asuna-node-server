import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RestCrudController } from '../core/base/base.controllers';

@ApiTags('sys-admin')
@Controller('admin/rest/app')
export class AppRestController extends RestCrudController {
  constructor() {
    super('app');
  }
}
