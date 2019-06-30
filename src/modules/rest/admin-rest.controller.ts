import { Controller } from '@nestjs/common';
import { RestCrudController } from '../core/base/base.controllers';

@Controller('admin/rest/admin')
export class AdminRestController extends RestCrudController {
  constructor() {
    super('admin');
  }
}
