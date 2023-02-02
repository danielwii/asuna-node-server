import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { r } from '@danielwii/asuna-helper/dist';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import _ from 'lodash';
import type { FilterQuery, Model } from 'mongoose';
// @ts-ignore
import ow from 'ow';

import { PageView, PageViewDocument } from './schema';
import { fileURLToPath } from 'node:url';

@Injectable()
export class WebService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(@InjectModel(PageView.name) private readonly PageViewModel: Model<PageViewDocument>) {}

  public addPageView(view: PageView): Promise<PageView> {
    const created = new this.PageViewModel(view);
    return created.save();
  }

  public async loadPageViews(suid: string): Promise<PageView[]> {
    ow(suid, 'suid', ow.string.nonEmpty);
    const filter: FilterQuery<PageViewDocument> = { scid: RegExp(`^${suid.trim()}.*`) };
    this.logger.log(`loadPageViews ${r({ suid, filter })}`);
    return this.PageViewModel.find(filter).sort({ at: -1 }).limit(6).exec();
  }

  public async loadEarliestPageView(suid: string): Promise<PageView> {
    ow(suid, 'suid', ow.string.nonEmpty);
    const filter: FilterQuery<PageViewDocument> = { scid: RegExp(`^${suid.trim()}.*`) };
    return this.PageViewModel.find(filter).sort({ at: 1 }).limit(1).exec().then(_.first);
  }

  public async loadLatestPageView(suid: string): Promise<PageView> {
    ow(suid, 'suid', ow.string.nonEmpty);
    const filter: FilterQuery<PageViewDocument> = { scid: RegExp(`^${suid.trim()}.*`) };
    return this.PageViewModel.find(filter).sort({ at: -1 }).limit(1).exec().then(_.first);
  }
}
