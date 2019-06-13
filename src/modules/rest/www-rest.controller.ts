import { Controller } from '@nestjs/common';

import { AsunaContext, RestCrudController } from '../core';

@Controller('rest')
export class WwwRestController extends RestCrudController {
  constructor() {
    super(AsunaContext.instance.defaultModulePrefix);
  }
}
