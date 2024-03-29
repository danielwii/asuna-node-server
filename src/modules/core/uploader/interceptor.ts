import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { fileURLToPath } from 'node:url';

export interface FastifyUploadedFile {
  filename: string;
  path: string;
  mimetype: string;
  encoding: string;
}
export type FastifyUploadedFileRequest = /* FastifyRequest & */ any & {
  file: FastifyUploadedFile;
  files: FastifyUploadedFile[];
};

export class FastifyFileInterceptor implements NestInterceptor {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  // 该 field 目前没有用户，multipart 中直接可以拿到 field
  constructor(private readonly field: string) {}

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    const request: FastifyUploadedFileRequest = context.switchToHttp().getRequest();
    this.logger.debug(`${context.getClass().name}.${context.getHandler().name} url: ${request.raw.url}`);

    request.files = [];

    return from(
      new Promise((resolve, reject) => {
        const promises = [];
        /*
        request.multipart(
          (field, file: NodeJS.ReadableStream, filename, encoding, mimetype) => {
            logger.log(
              `handle file upload ${r({ field, /!*file, *!/ filename, encoding, mimetype })}`,
            );
            const tempFilename = `${uuid.v4()}.${mimetype.split('/').slice(-1)}__${filename}`;
            const promise = ReqHelper.saveFile(file, tempFilename).then(path => {
              request.files.push({ filename, path, mimetype, encoding });
            });
            promises.push(promise);
          },
          err => {
            if (err) {
              logger.error(`upload error occurred:  ${r(err)}`);
              reject(err);
            }
            bluebird.all(promises).then(() => {
              logger.log(`upload complete. total: ${request.files.length}`);
              request.file = request.files[0];
              resolve();
            });
          },
        );
*/
      }),
    ).pipe(switchMap(() => next.handle()));
  }
}
