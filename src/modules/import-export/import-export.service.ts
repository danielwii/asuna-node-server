import { Injectable } from '@nestjs/common';
import { read, utils, write } from 'xlsx';
import { LoggerFactory } from '../common/logger';
import { DBHelper } from '../core/db';
import { r } from '../common/helpers';

const logger = LoggerFactory.getLogger('ImportExportService');

@Injectable()
export class ImportExportService {
  // 获取repo
  private async getRepository(model: string) {
    const modelName = DBHelper.getModelName(model, '');
    return DBHelper.repo(modelName);
    // return DBHelper.extractAsunaSchemas(repository,{ module: 'www__', prefix: 't_' });
  }
  // 获取字段名称
  private async getSchemas(repository) {
    const schemas = DBHelper.extractAsunaSchemas(repository, { module: '', prefix: 't' });
    const res = [];
    schemas.forEach(value => {
      if (
        value['name'] !== 'ordinal' &&
        value['name'] !== 'logoAlt' &&
        value['name'] !== 'videos' &&
        value['name'] !== 'coverAlt' &&
        value['name'] !== 'studentAlt' &&
        value['name'] !== 'isPublished' &&
        value['name'] !== 'isFeatured' &&
        value['name'] !== 'offers' &&
        value['config']['info'] !== null &&
        value['config']['info'] !== undefined &&
        value['config']['info']['type'] !== 'Image' &&
        value['config']['info']['name'] !== null &&
        value['config']['info']['name'] !== undefined
      ) {
        res.push(value);
      }
    });
    return res;
  }

  // 导入Excel
  async importExcel(fileBuffer: any, modelName: string) {
    const workbook = read(fileBuffer, {});
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonArray = utils.sheet_to_json(worksheet, { header: 1 });
    const repository = await this.getRepository(modelName);
    const schemas = await this.getSchemas(repository);
    const status = [];
    for (let row = 1; row < jsonArray.length; row += 1) {
      const entity = repository.create();
      for (let column = 0; column < schemas.length; column += 1) {
        if (jsonArray[0][column] === schemas[column]['config']['info']['name']) {
          const keyName = schemas[column]['name'];
          let value = jsonArray[row][column];
          // 如果是外键关系表，则需要处理外键表数据
          if (schemas[column]['config']['selectable'] !== undefined) {
            const tempRepo = await this.getRepository(schemas[column]['config']['selectable']);
            if (!schemas[column]['config']['many']) {
              const res = await tempRepo.findOne({ name: jsonArray[row][column] });
              value = res;
            } else {
              // 处理多对多关系
              const content: string = jsonArray[row][column];
              if (content !== undefined) {
                const contentArray = content.split('、');
                const resArray = [];
                contentArray.forEach(async temp => {
                  const res = await tempRepo.findOne({ name: temp.trim() });
                  if (res !== undefined) {
                    resArray.push(res);
                  }
                });
                value = resArray;
              }
            }
          }
          // 如果表中已有该数据则删除
          if (keyName === 'name') {
            const res = await repository.findOne({ name: jsonArray[row][column] });
            if (res !== undefined) {
              await repository.remove(res);
            }
          }
          // logger.debug(`${modelName} set ${keyName} to ${value}`);
          entity[keyName] = value;
        }
      }
      logger.verbose(`save ${modelName}: ${r(entity)} by ${r(jsonArray[row])}`);
      const saveRes = await repository.save(entity);
      status.push(saveRes);
    }
    return status;
  }

  // 导出Excel
  exportExcel(json: any[]): any {
    const ss = utils.json_to_sheet(json); // 通过工具将json转表对象'
    const keys = Object.keys(ss).sort(); // 排序 [需要注意，必须从A1开始]
    // 构建 workbook 对象
    const workbook = {
      // 定义 作文档
      SheetNames: ['sheet1'], // 定义表明
      Sheets: {
        sheet1: Object.assign({}, ss, {}), // 表对象[注意表明]
      },
    };
    const buf = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buf;
  }

  // 导出Excel模板
  async exportModel(tableName: string) {
    const repository = await this.getRepository(tableName);
    const schemas = await this.getSchemas(repository);
    const json = [];
    schemas.forEach(value => {
      const temp = [];
      temp[value['config']['info']['name']] = null;
      json.push(temp);
    });
    const ss = utils.json_to_sheet(json); // 通过工具将json转表对象
    // const keys = Object.keys(ss).sort(); // 排序 [需要注意，必须从A1开始]
    // 构建 workbook 对象
    const workbook = {
      // 定义 作文档
      SheetNames: ['sheet1'], // 定义表明
      Sheets: {
        sheet1: Object.assign({}, ss, {}), // 表对象[注意表明]
      },
    };
    const buf = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buf;
  }
}
