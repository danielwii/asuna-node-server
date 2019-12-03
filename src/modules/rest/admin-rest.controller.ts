import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RestCrudController } from '../core/base/base.controllers';

@ApiTags('sys-admin')
@Controller('admin/rest/admin')
export class AdminRestController extends RestCrudController {
  constructor() {
    super('admin');
  }
}
