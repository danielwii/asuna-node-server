import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AsunaContext } from '../core';
import { RestCrudController } from '../core/base/base.controllers';

@ApiTags('sys-rest')
@Controller('rest')
export class WwwRestController extends RestCrudController {
  constructor() {
    super(AsunaContext.instance.defaultModulePrefix);
  }
}
