import { Body, Controller, Param, Post } from '@nestjs/common';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { CreateDynamicFormDTO } from './form.schema';
import { FormService } from './form.service';

const logger = LoggerFactory.getLogger('FormController');

@Controller('api/v1/form')
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Post()
  async create(@Body() dto: CreateDynamicFormDTO) {
    logger.log(`create ${r(dto)}`);
    await this.formService.create(dto);
  }

  @Post(':type')
  async createTyped(@Body() dto: object, @Param('type') type: string) {
    logger.log(`create ${r({ type, dto })}`);
  }
}
