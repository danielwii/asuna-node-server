import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { LoggerFactory, r } from '@danielwii/asuna-helper';

import _ from 'lodash';
import { FilterQuery, Model } from 'mongoose';
import ow from 'ow';

import { PageView, PageViewDocument } from './schema';

const logger = LoggerFactory.getLogger('WebService');

@Injectable()
export class WebService {
  public constructor(@InjectModel(PageView.name) private readonly PageViewModel: Model<PageViewDocument>) {}

  public addPageView(view: PageView): Promise<PageView> {
    const created = new this.PageViewModel(view);
    return created.save();
  }

  public async loadPageViews(suid: string): Promise<PageView[]> {
    ow(suid, 'suid', ow.string.nonEmpty);
    const filter: FilterQuery<PageViewDocument> = { scid: RegExp(`^${suid.trim()}.*`) };
    logger.log(`loadPageViews ${r({ suid, filter })}`);
    return this.PageViewModel.find(filter).sort({ at: -1 }).limit(6).exec();
  }

  public async loadEarliestPageView(suid: string): Promise<PageView> {
    ow(suid, 'suid', ow.string.nonEmpty);
    const filter: FilterQuery<PageViewDocument> = { scid: RegExp(`^${suid.trim()}.*`) };
    return this.PageViewModel.find(filter).sort({ at: 1 }).limit(1).exec().then(_.first);
  }
}
