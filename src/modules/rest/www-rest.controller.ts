import { Controller } from '@nestjs/common';

import { AsunaContext } from '../core';
import { RestCrudController } from './base.controllers';

@Controller('rest')
export class WwwRestController extends RestCrudController {
  public constructor() {
    super(AsunaContext.instance.defaultModulePrefix);
  }
}
