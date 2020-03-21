import { Body, Controller, Post } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { CreateDynamicFormDTO } from './form.schema';
import { FormService } from './form.service';
import { r } from '../common/helpers/utils';

const logger = LoggerFactory.getLogger('FormController');

@Controller('api/v1/form')
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Post()
  async create(@Body() dto: CreateDynamicFormDTO) {
    logger.log(`create ${r(dto)}`);
    await this.formService.create(dto);
  }
}
