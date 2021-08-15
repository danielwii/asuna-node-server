import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { PageViewDocument, PageView } from './schema';

@Injectable()
export class WebService {
  public constructor(@InjectModel(PageView.name) private readonly pageViewModel: Model<PageViewDocument>) {}
  public addPageView(view: PageView): Promise<PageView> {
    const created = new this.pageViewModel(view);
    return created.save();
  }
}
