import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';

import { AsunaContext } from '../core';
import { RestCrudController } from '../core/base/base.controllers';

@ApiUseTags('sys-rest')
@Controller('rest')
export class WwwRestController extends RestCrudController {
  constructor() {
    super(AsunaContext.instance.defaultModulePrefix);
  }
}
