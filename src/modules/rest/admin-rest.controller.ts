import { Controller } from '@nestjs/common';

import { RestCrudController } from '../base';

@Controller('admin/rest/admin')
export class AdminRestController extends RestCrudController {
  constructor() {
    super('admin');
  }
}
