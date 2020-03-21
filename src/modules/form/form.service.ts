import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDynamicFormDTO, DynamicForm, DynamicFormModels } from './form.schema';

@Injectable()
export class FormService {
  constructor(@InjectModel(DynamicFormModels.DynamicForm) private readonly formModel: Model<DynamicForm>) {}

  async create(dto: CreateDynamicFormDTO): Promise<DynamicForm> {
    // eslint-disable-next-line new-cap
    return new this.formModel(dto).save();
  }

  async findByName(name: string): Promise<DynamicForm[]> {
    return this.formModel.find({ name }).exec();
  }
}
