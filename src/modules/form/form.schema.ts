import * as mongoose from 'mongoose';
import { Document } from 'mongoose';

export enum DynamicFormModels {
  DynamicForm = 'DynamicForm',
}

export const DynamicFormSchema = new mongoose.Schema({
  name: String,
  value: Object,
});

export class CreateDynamicFormDTO {
  readonly name: string;
  readonly value: object;
}

export class DynamicForm extends Document {
  readonly name: string;
  readonly value: object;
}
