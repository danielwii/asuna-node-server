import { Controller } from '@nestjs/common';

import { RestCrudController } from '../sys';
import { AsunaContext } from '../core';

@Controller('rest')
export class WwwRestController extends RestCrudController {
  constructor() {
    super(AsunaContext.instance.defaultModulePrefix);
  }
}
