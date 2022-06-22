import { Injectable, Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import { read, utils, write } from 'xlsx';

import { DBHelper } from '../core/db';

const logger = new Logger(resolveModule(__filename, 'ImportExportService'));

@Injectable()
export class ImportExportService {
  // 获取repo
  private static getRepository(model: string) {
    const modelName = DBHelper.getModelNameObject(model, '');
    return DBHelper.repo(modelName);
    // return DBHelper.extractAsunaSchemas(repository,{ module: 'www__', prefix: 't_' });
  }

  // 获取字段名称
  private async getSchemas(repository) {
    const schemas = DBHelper.extractAsunaSchemas(repository, { module: '', prefix: 't' });
    const res = [];
    schemas.forEach((value) => {
      if (
        !['ordinal', 'logoAlt', 'videos', 'coverAlt', 'studentAlt', 'isPublished', 'isFeatured', 'offers'].includes(
          value.name,
        ) &&
        value.config.info &&
        value.config.info.type !== 'Image' &&
        value.config.info.name
      ) {
        res.push(value);
      }
    });
    return res;
  }

  // 导入Excel
  public async importExcel(fileBuffer: any, modelName: string) {
    const workbook = read(fileBuffer, {});
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonArray = utils.sheet_to_json(worksheet, { header: 1 });
    const repository = await ImportExportService.getRepository(modelName);
    const schemas = await this.getSchemas(repository);
    const status = [];
    for (let row = 1; row < jsonArray.length; row += 1) {
      const entity = repository.create();
      for (const [column, element] of schemas.entries()) {
        if (jsonArray[0][column] === element.config.info.name) {
          const keyName = element.name;
          let value = jsonArray[row][column];
          // 如果是外键关系表，则需要处理外键表数据
          if (element.config.selectable !== undefined) {
            const tempRepo = await ImportExportService.getRepository(element.config.selectable);
            if (!element.config.many) {
              value = await tempRepo.findOne({ name: jsonArray[row][column] } as any);
            } else {
              // 处理多对多关系
              const content: string = jsonArray[row][column];
              if (content !== undefined) {
                const contentArray = content.split('、');
                const resArray = [];
                await Promise.each(contentArray, async (temp) => {
                  const res = await tempRepo.findOne({ name: temp.trim() } as any);
                  if (res !== undefined) resArray.push(res);
                });
                value = resArray;
              }
            }
          }
          // 如果表中已有该数据则删除
          if (keyName === 'name') {
            const res = await repository.findOne({ name: jsonArray[row][column] } as any);
            if (res !== undefined) {
              await repository.remove(res);
            }
          }
          // logger.verbose(`${modelName} set ${keyName} to ${value}`);
          entity[keyName] = value;
        }
      }
      logger.debug(`save ${modelName}: ${r(entity)} by ${r(jsonArray[row])}`);
      const saveRes = await repository.save(entity);
      status.push(saveRes);
    }
    return status;
  }

  // 导出Excel
  public exportExcel(json: any[]): any {
    const ss = utils.json_to_sheet(json); // 通过工具将json转表对象'
    const keys = Object.keys(ss).sort(); // 排序 [需要注意，必须从A1开始]
    // 构建 workbook 对象
    const workbook = {
      // 定义 作文档
      SheetNames: ['sheet1'], // 定义表明
      Sheets: {
        sheet1: { ...ss }, // 表对象[注意表明]
      },
    };
    const buf = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buf;
  }

  // 导出Excel模板
  public async exportModel(tableName: string): Promise<any> {
    const repository = await ImportExportService.getRepository(tableName);
    const schemas = await this.getSchemas(repository);
    const json = [];
    schemas.forEach((value) => {
      const temp = [];
      temp[value.config.info.name] = null;
      json.push(temp);
    });
    const ss = utils.json_to_sheet(json); // 通过工具将json转表对象
    // const keys = Object.keys(ss).sort(); // 排序 [需要注意，必须从A1开始]
    // 构建 workbook 对象
    const workbook = {
      // 定义 作文档
      SheetNames: ['sheet1'], // 定义表明
      Sheets: {
        sheet1: { ...ss }, // 表对象[注意表明]
      },
    };
    const buf = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buf;
  }
}
