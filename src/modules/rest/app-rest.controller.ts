import { Controller } from '@nestjs/common';

import { RestCrudController } from '../sys';

@Controller('admin/rest/app')
export class AppRestController extends RestCrudController {
  constructor() {
    super('app');
  }
}
