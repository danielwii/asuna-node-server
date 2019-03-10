import { Controller } from '@nestjs/common';

import { RestCrudController } from '../base/base.controllers';

@Controller('rest')
export class AppRestController extends RestCrudController {
  constructor() {
    super('app');
  }
}
