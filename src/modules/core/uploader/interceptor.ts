import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
// import { FastifyRequest } from 'fastify';
// import 'fastify-multipart';
import { Observable } from 'rxjs';
import { fromPromise } from 'rxjs/internal-compatibility';
import { switchMap } from 'rxjs/operators';
import { LoggerFactory } from '../../common/logger';

const logger = LoggerFactory.getLogger('FastifyFileInterceptor');

export type FastifyUploadedFile = {
  filename: string;
  path: string;
  mimetype: string;
  encoding: string;
};
export type FastifyUploadedFileRequest = /* FastifyRequest & */ any & {
  file: FastifyUploadedFile;
  files: FastifyUploadedFile[];
};

export class FastifyFileInterceptor implements NestInterceptor {
  // 该 field 目前没有用户，multipart 中直接可以拿到 field
  constructor(private readonly field: string) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request: FastifyUploadedFileRequest = context.switchToHttp().getRequest();
    logger.debug(`${context.getClass().name}.${context.getHandler().name} url: ${request.raw.url}`);

    request.files = [];

    return fromPromise(
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
