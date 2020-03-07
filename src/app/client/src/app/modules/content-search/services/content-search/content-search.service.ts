import { Injectable, EventEmitter } from '@angular/core';
import { OrgDetailsService, FrameworkService, ChannelService } from '@sunbird/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { skipWhile, mergeMap, first, map } from 'rxjs/operators';
import * as _ from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class ContentSearchService {
  private channelId: string;
  public _frameworkId = '';
  get frameworkId() {
    return this._frameworkId;
  }
  private defaultBoard: string;
  private custodianOrg: boolean;
  private _filters = {
    board: [],
    medium: [],
    gradeLevel: [],
    subject: []
  };
  get filters() {
    return _.cloneDeep(this._filters);
  }
  private _searchResults$ = new BehaviorSubject<any>(undefined);
  get searchResults$(): Observable<any[]> {
    return this._searchResults$.asObservable()
      .pipe(skipWhile(data => data === undefined || data === null));
  }

  constructor(private frameworkService: FrameworkService, private orgDetailsService: OrgDetailsService,
    private channelService: ChannelService) { }

  public initialize(channelId: string, custodianOrg = false, defaultBoard: string) {
    this.channelId = channelId;
    this.custodianOrg = custodianOrg;
    this.defaultBoard = defaultBoard;
    this._searchResults$.complete(); // to flush old subscription
    this._searchResults$ = new BehaviorSubject<any>(undefined);
    return this.fetchChannelData();
  }
  private fetchChannelData() {
    return this.channelService.getFrameWork(this.channelId)
    .pipe(mergeMap((channelDetails) => {
      if (this.custodianOrg) {
        this._filters.board = _.get(channelDetails, 'result.channel.frameworks') || [{
          name: _.get(channelDetails, 'result.channel.defaultFramework'),
          identifier: _.get(channelDetails, 'result.channel.defaultFramework')
        }]; // framework array is empty assigning defaultFramework as only board
        this.pushDummyBoard();
        const selectedBoard = this._filters.board.find((board) => board.name === this.defaultBoard) || this._filters.board[0];
        this._frameworkId = _.get(selectedBoard, 'identifier');
      } else {
        this._frameworkId = _.get(channelDetails, 'result.channel.defaultFramework');
      }
      return this.frameworkService.getFrameworkCategories(this._frameworkId);
    }), map(frameworkDetails => {
      const frameworkCategories: any[] = _.get(frameworkDetails, 'result.framework.categories');
      frameworkCategories.forEach(category => {
        if (['medium', 'gradeLevel', 'subject'].includes(category.code)) {
          this._filters[category.code] = category.terms || [];
        } else if (!this.custodianOrg && category.code === 'board') {
          this._filters[category.code] = category.terms || [];
        }
      });
      return true;
    }), first());
  }
  private pushDummyBoard() {
    this._filters.board.push({
      identifier: 'NCF',
      code: 'NCF',
      name: 'NCF framework',
      description: ' NCF framework...',
      type: 'K-12',
      objectType: 'Framework'
    });
  }
  public fetchFilter(boardName?) {
    if (!this.custodianOrg || !boardName) {
      return of(this.filters);
    }
    const selectedBoard = this._filters.board.find((board) => board.name === boardName)
      || this._filters.board.find((board) => board.name === this.defaultBoard) || this._filters.board[0];
    this._frameworkId = this._frameworkId = _.get(selectedBoard, 'identifier');
    return this.frameworkService.getFrameworkCategories(this._frameworkId).pipe(map(frameworkDetails => {
      const frameworkCategories: any[] = _.get(frameworkDetails, 'result.framework.categories');
      frameworkCategories.forEach(category => {
        if (['medium', 'gradeLevel', 'subject'].includes(category.code)) {
          this._filters[category.code] = category.terms || [];
        } else if (category.code === 'board' && !this.custodianOrg) {
          this._filters[category.code] = category.terms || [];
        }
      });
      return this.filters;
    }), first());
  }
}
