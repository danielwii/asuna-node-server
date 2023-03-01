import { Controller } from '@nestjs/common';

import { AsunaContext } from '../core';
import { RestCrudController } from './base.controllers';

@Controller('rest')
export class WwwAdminRestController extends RestCrudController {
  public constructor() {
    super(AsunaContext.instance.defaultModulePrefix);
  }
}
