import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { RestCrudController } from '../core/base/base.controllers';

@ApiUseTags('sys-admin')
@Controller('admin/rest/admin')
export class AdminRestController extends RestCrudController {
  constructor() {
    super('admin');
  }
}
