import { Controller } from '@nestjs/common';

import { RestCrudController } from '../sys';

@Controller('admin/rest/admin')
export class AdminRestController extends RestCrudController {
  constructor() {
    super('admin');
  }
}
