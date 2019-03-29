import { Controller } from '@nestjs/common';

import { RestCrudController } from '../base';

@Controller('rest')
export class AppRestController extends RestCrudController {
  constructor() {
    super('app');
  }
}
