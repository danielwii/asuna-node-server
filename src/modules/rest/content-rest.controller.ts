import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RestCrudController } from '../core/base/base.controllers';

@ApiTags('sys-admin')
@Controller('admin/rest/content')
export class ContentRestController extends RestCrudController {
  constructor() {
    super('content');
  }
}
