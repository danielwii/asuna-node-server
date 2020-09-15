import { Body, Controller, Get, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { LoggerFactory } from '../common/logger';
import { ImportExportService } from './import-export.service';

const logger = LoggerFactory.getLogger('ImportExportController');

@Controller('api/v1/import-export')
export class ImportExportController {
  public constructor(private readonly importExportService: ImportExportService) {}

  // 导入Excel 请求地址传入param参数，传入导入的表名
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  public async importExcel(@UploadedFile() file, @Req() req: Request) {
    const modelName = req.query.name as string;
    if (!file) return '上传文件为空！';
    if (file.originalname.substr(-5) !== '.xlsx' && file.originalname.substr(-4) !== '.xls') {
      return '文件格式有误！';
    }
    const resEntity = await this.importExportService.importExcel(file.buffer, modelName);
    logger.log(`import excel ${JSON.stringify(resEntity)}`);
    return resEntity;
  }

  // 导出Excel
  @Get('export')
  public exportExcel(@Res() res: Response, @Body() body: any[]) {
    const buf = this.importExportService.exportExcel(body);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    logger.log('export excel');
    res.end(buf);
  }

  // 下载excel模板, 请求地址传入param参数，传入导入的表名
  @Get('model')
  public async exportModel(@Res() res: Response, @Req() req: Request) {
    const modelName = req.query.name as string;
    const buf = await this.importExportService.exportModel(modelName);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=model.xlsx',
    });
    logger.log('export excel model');
    res.end(buf);
  }
}
