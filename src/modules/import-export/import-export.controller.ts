import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoggerFactory } from '../common/logger';
import { ImportExportService } from './import-export.service';

const logger = LoggerFactory.getLogger('ImportExportController');

@Controller('api/v1/import-export')
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  // 导入Excel 请求地址传入param参数，传入导入的表名
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file, @Req() req) {
    const modelName = req.query.name;
    if (file == null) return '上传文件为空！';
    if (file.originalname.substr(-5) !== '.xlsx' && file.originalname.substr(-4) !== '.xls') {
      return '文件格式有误！';
    }
    const resEntity = await this.importExportService.importExcel(file.buffer, modelName);
    logger.log(`import excel ${JSON.stringify(resEntity)}`);
    return resEntity;
  }

  // 导出Excel
  @Get('export')
  exportExcel(@Res() res, @Body() body: any[]) {
    const buf = this.importExportService.exportExcel(body);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    logger.log('export excel');
    res.send(buf);
  }

  // 下载excel模板, 请求地址传入param参数，传入导入的表名
  @Get('model')
  async exportModel(@Res() res, @Req() req) {
    const modelName = req.query.name;
    const buf = await this.importExportService.exportModel(modelName);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=model.xlsx',
    });
    logger.log('export excel model');
    res.send(buf);
  }
}
