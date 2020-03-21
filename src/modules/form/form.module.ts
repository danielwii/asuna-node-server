import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerFactory } from '../common/logger';
import { FormController } from './form.controller';
import { DynamicFormModels, DynamicFormSchema } from './form.schema';
import { FormService } from './form.service';

const logger = LoggerFactory.getLogger('FormModule');

@Module({
  imports: [MongooseModule.forFeature([{ name: DynamicFormModels.DynamicForm, schema: DynamicFormSchema }])],
  controllers: [FormController],
  providers: [FormService],
})
export class FormModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');
  }
}
