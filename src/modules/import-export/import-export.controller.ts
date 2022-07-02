import { Body, Controller, Get, Logger, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { ImportExportService } from './import-export.service';

import type { Request, Response } from 'express';

@Controller('api/v1/import-export')
export class ImportExportController {
  private readonly logger = new Logger(resolveModule(__filename, ImportExportController.name));

  public constructor(private readonly importExportService: ImportExportService) {}

  // 导入Excel 请求地址传入param参数，传入导入的表名
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  public async importExcel(@UploadedFile() file, @Query('name') name: string, @Req() req: Request) {
    if (!file) return '上传文件为空！';
    if (file.originalname.substr(-5) !== '.xlsx' && file.originalname.substr(-4) !== '.xls') {
      return '文件格式有误！(.xlsx, .xls)';
    }
    const resEntity = await this.importExportService.importExcel(file.buffer, name);
    this.logger.log(`imported excel is ${r(resEntity)}`);
    return resEntity;
  }

  // 导出Excel
  @Get('export')
  public exportExcel(@Res() res: Response, @Body() body: any[]) {
    const buf = this.importExportService.exportExcel(body);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    this.logger.log('export excel');
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
    this.logger.log('export excel model');
    res.end(buf);
  }
}
