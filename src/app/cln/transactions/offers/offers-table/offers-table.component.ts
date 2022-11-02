/* eslint-disable max-len */
import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { faHistory } from '@fortawesome/free-solid-svg-icons';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

import { PAGE_SIZE, PAGE_SIZE_OPTIONS, getPaginatorLabel, ScreenSizeEnum, APICallStatusEnum, AlertTypeEnum, SortOrderEnum, CLN_DEFAULT_PAGE_SETTINGS, CLN_PAGE_DEFS } from '../../../../shared/services/consts-enums-functions';
import { ApiCallStatusPayload } from '../../../../shared/models/apiCallsPayload';
import { SelNodeChild } from '../../../../shared/models/RTLconfig';
import { GetInfo, Offer, OfferRequest } from '../../../../shared/models/clnModels';
import { DataService } from '../../../../shared/services/data.service';
import { LoggerService } from '../../../../shared/services/logger.service';
import { CommonService } from '../../../../shared/services/common.service';

import { CLNCreateOfferComponent } from '../create-offer-modal/create-offer.component';
import { CLNOfferInformationComponent } from '../offer-information-modal/offer-information.component';

import { RTLEffects } from '../../../../store/rtl.effects';
import { RTLState } from '../../../../store/rtl.state';
import { openAlert, openConfirmation } from '../../../../store/rtl.actions';
import { disableOffer } from '../../../store/cln.actions';
import { clnNodeInformation, clnNodeSettings, clnPageSettings, offers } from '../../../store/cln.selector';
import { ColumnDefinition, PageSettings, TableSetting } from '../../../../shared/models/pageSettings';
import { CamelCaseWithReplacePipe } from '../../../../shared/pipes/app.pipe';

@Component({
  selector: 'rtl-cln-offers-table',
  templateUrl: './offers-table.component.html',
  styleUrls: ['./offers-table.component.scss'],
  providers: [
    { provide: MatPaginatorIntl, useValue: getPaginatorLabel('Offers') }
  ]
})
export class CLNOffersTableComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild(MatSort, { static: false }) sort: MatSort | undefined;
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator | undefined;
  faHistory = faHistory;
  public nodePageDefs = CLN_PAGE_DEFS;
  public selFilterBy = 'all';
  public colWidth = '20rem';
  public PAGE_ID = 'transactions';
  public tableSetting: TableSetting = { tableId: 'offers', recordsPerPage: PAGE_SIZE, sortBy: 'offer_id', sortOrder: SortOrderEnum.DESCENDING };
  public selNode: SelNodeChild | null = {};
  public newlyAddedOfferMemo = '';
  public newlyAddedOfferValue = 0;
  public description = '';
  public expiry: number;
  public offerValue: number | null = null;
  public offerValueHint = '';
  public displayedColumns: any[] = [];
  public offerPaymentReq = '';
  public offers: any;
  public offerJSONArr: Offer[] = [];
  public information: GetInfo = {};
  public private = false;
  public expiryStep = 100;
  public pageSize = PAGE_SIZE;
  public pageSizeOptions = PAGE_SIZE_OPTIONS;
  public screenSize = '';
  public screenSizeEnum = ScreenSizeEnum;
  public errorMessage = '';
  public selFilter = '';
  public apiCallStatus: ApiCallStatusPayload | null = null;
  public apiCallStatusEnum = APICallStatusEnum;
  private unSubs: Array<Subject<void>> = [new Subject(), new Subject(), new Subject(), new Subject(), new Subject(), new Subject(), new Subject()];

  constructor(private logger: LoggerService, private store: Store<RTLState>, private commonService: CommonService, private rtlEffects: RTLEffects, private dataService: DataService, private decimalPipe: DecimalPipe, private camelCaseWithReplace: CamelCaseWithReplacePipe) {
    this.screenSize = this.commonService.getScreenSize();
  }

  ngOnInit() {
    this.store.select(clnNodeSettings).pipe(takeUntil(this.unSubs[0])).subscribe((nodeSettings: SelNodeChild | null) => {
      this.selNode = nodeSettings;
    });
    this.store.select(clnNodeInformation).pipe(takeUntil(this.unSubs[1])).subscribe((nodeInfo: GetInfo) => {
      this.information = nodeInfo;
    });
    this.store.select(clnPageSettings).pipe(takeUntil(this.unSubs[2])).
      subscribe((settings: { pageSettings: PageSettings[], apiCallStatus: ApiCallStatusPayload }) => {
        this.errorMessage = '';
        this.apiCallStatus = settings.apiCallStatus;
        if (this.apiCallStatus.status === APICallStatusEnum.ERROR) {
          this.errorMessage = this.apiCallStatus.message || '';
        }
        this.tableSetting = settings.pageSettings.find((page) => page.pageId === this.PAGE_ID)?.tables.find((table) => table.tableId === this.tableSetting.tableId) || CLN_DEFAULT_PAGE_SETTINGS.find((page) => page.pageId === this.PAGE_ID)?.tables.find((table) => table.tableId === this.tableSetting.tableId)!;
        if (this.screenSize === ScreenSizeEnum.XS || this.screenSize === ScreenSizeEnum.SM) {
          this.displayedColumns = JSON.parse(JSON.stringify(this.tableSetting.columnSelectionSM));
        } else {
          this.displayedColumns = JSON.parse(JSON.stringify(this.tableSetting.columnSelection));
        }
        this.displayedColumns.unshift('active');
        this.displayedColumns.push('actions');
        this.pageSize = this.tableSetting.recordsPerPage ? +this.tableSetting.recordsPerPage : PAGE_SIZE;
        this.colWidth = this.displayedColumns.length ? ((this.commonService.getContainerSize().width / this.displayedColumns.length) / 10) + 'rem' : '20rem';
        this.logger.info(this.displayedColumns);
      });
    this.store.select(offers).pipe(takeUntil(this.unSubs[3])).
      subscribe((offersSeletor: { offers: Offer[], apiCallStatus: ApiCallStatusPayload }) => {
        this.errorMessage = '';
        this.apiCallStatus = offersSeletor.apiCallStatus;
        if (this.apiCallStatus.status === APICallStatusEnum.ERROR) {
          this.errorMessage = !this.apiCallStatus.message ? '' : (typeof (this.apiCallStatus.message) === 'object') ? JSON.stringify(this.apiCallStatus.message) : this.apiCallStatus.message;
        }
        this.offerJSONArr = offersSeletor.offers || [];
        if (this.offerJSONArr && this.offerJSONArr.length > 0 && this.sort && this.paginator && this.displayedColumns.length > 0) {
          this.loadOffersTable(this.offerJSONArr);
        }
        this.logger.info(offersSeletor);
      });
  }

  ngAfterViewInit() {
    if (this.offerJSONArr && this.offerJSONArr.length > 0 && this.sort && this.paginator && this.displayedColumns.length > 0) {
      this.loadOffersTable(this.offerJSONArr);
    }
  }

  openCreateOfferModal() {
    this.store.dispatch(openAlert({
      payload: {
        data: {
          pageSize: this.pageSize,
          component: CLNCreateOfferComponent
        }
      }
    }));
  }

  onOfferClick(selOffer: Offer) {
    const reCreatedOffer: Offer = {
      used: selOffer.used,
      single_use: selOffer.single_use,
      active: selOffer.active,
      offer_id: selOffer.offer_id,
      bolt12: selOffer.bolt12,
      bolt12_unsigned: selOffer.bolt12_unsigned
    };
    this.store.dispatch(openAlert({
      payload: {
        data: {
          offer: reCreatedOffer,
          newlyAdded: false,
          component: CLNOfferInformationComponent
        }
      }
    }));
  }

  onDisableOffer(selOffer: Offer) {
    this.store.dispatch(openConfirmation({
      payload: {
        data: {
          type: AlertTypeEnum.CONFIRM,
          alertTitle: 'Disable Offer',
          titleMessage: 'Disabling Offer: ' + (selOffer.offer_id || selOffer.bolt12),
          noBtnText: 'Cancel',
          yesBtnText: 'Disable'
        }
      }
    }));
    this.rtlEffects.closeConfirm.pipe(takeUntil(this.unSubs[4])).subscribe((confirmRes) => {
      if (confirmRes) {
        this.store.dispatch(disableOffer({ payload: { offer_id: selOffer.offer_id! } }));
      }
    });
  }

  onPrintOffer(selOffer: Offer) {
    this.dataService.decodePayment(selOffer.bolt12!, false).
      pipe(take(1)).subscribe((offerDecoded: OfferRequest) => {
        if (offerDecoded.offer_id && !offerDecoded.amount_msat) {
          offerDecoded.amount_msat = '0msat';
          offerDecoded.amount = 0;
        } else {
          offerDecoded.amount = offerDecoded.amount ? +offerDecoded.amount : offerDecoded.amount_msat ? +offerDecoded.amount_msat.slice(0, -4) : null;
        }
        const documentDefinition = {
          pageSize: 'A5',
          pageOrientation: 'portrait',
          pageMargins: [10, 50, 10, 50],
          background: {
            svg: `
              <svg width="249" height="333" viewBox="0 0 249 333" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
              <rect width="249" height="333" rx="17" fill="black"/>
              <rect x="8" y="8" width="233" height="251" rx="12" fill="white"/>
              <rect x="78" width="89" height="25" rx="9" fill="black"/>
              <path d="M101.051 18L102.534 9.46875L105.036 9.47461C105.907 9.47461 106.559 9.66992 106.993 10.0605C107.426 10.4512 107.616 10.9961 107.561 11.6953C107.491 12.5117 106.977 13.127 106.02 13.541C106.403 13.6895 106.688 13.9434 106.875 14.3027C107.067 14.6621 107.145 15.0586 107.11 15.4922C107.051 16.2617 106.743 16.873 106.184 17.3262C105.625 17.7754 104.903 18 104.016 18H101.051ZM102.844 14.0098L102.311 17.0801L104.051 17.0859C104.582 17.0859 105.028 16.9434 105.387 16.6582C105.746 16.373 105.955 15.9883 106.014 15.5039C106.069 15.043 105.989 14.6836 105.774 14.4258C105.559 14.168 105.221 14.0312 104.76 14.0156L102.844 14.0098ZM103.002 13.1074L104.59 13.1133C105.086 13.1133 105.504 12.9863 105.844 12.7324C106.188 12.4785 106.389 12.1289 106.448 11.6836C106.498 11.2695 106.416 10.957 106.202 10.7461C105.991 10.5352 105.639 10.4199 105.147 10.4004L103.471 10.3945L103.002 13.1074ZM112.153 18.1172C111.61 18.1055 111.137 17.9746 110.735 17.7246C110.336 17.4746 110.022 17.1074 109.791 16.623C109.561 16.1348 109.434 15.5879 109.41 14.9824C109.387 14.5098 109.44 13.9258 109.569 13.2305C109.697 12.5352 109.92 11.9082 110.237 11.3496C110.553 10.791 110.938 10.3438 111.391 10.0078C112.004 9.55469 112.703 9.33594 113.489 9.35156C114.321 9.36719 114.977 9.65625 115.457 10.2188C115.938 10.7773 116.196 11.5352 116.231 12.4922C116.246 12.9023 116.203 13.4238 116.102 14.0566C116.004 14.6895 115.826 15.2773 115.569 15.8203C115.315 16.3633 114.99 16.8184 114.596 17.1855C113.908 17.8262 113.094 18.1367 112.153 18.1172ZM115.147 12.7617C115.17 11.9922 115.035 11.3965 114.742 10.9746C114.449 10.5488 114.014 10.3281 113.436 10.3125C112.912 10.2969 112.444 10.4375 112.03 10.7344C111.619 11.0312 111.281 11.4766 111.016 12.0703C110.754 12.6602 110.588 13.4082 110.518 14.3145L110.5 14.6953C110.477 15.4609 110.614 16.0605 110.91 16.4941C111.207 16.9277 111.639 17.1523 112.205 17.168C112.944 17.1875 113.555 16.9219 114.039 16.3711C114.528 15.8164 114.852 15.0391 115.012 14.0391C115.09 13.5469 115.135 13.1211 115.147 12.7617ZM119.012 17.0801H122.938L122.774 18H117.746L119.229 9.46875H120.336L119.012 17.0801ZM130.16 10.3945H127.506L126.187 18H125.092L126.41 10.3945H123.756L123.92 9.46875H130.324L130.16 10.3945ZM133.978 18H132.912L134.166 10.8047L131.898 11.6016L132.08 10.5703L135.244 9.42773H135.431L133.978 18ZM143.263 18H137.832L137.961 17.1738L141.107 14.1152L141.681 13.5469C142.341 12.8867 142.707 12.2773 142.777 11.7188C142.828 11.2891 142.744 10.9395 142.525 10.6699C142.306 10.3965 141.998 10.252 141.599 10.2363C141.087 10.2207 140.66 10.3711 140.316 10.6875C139.972 11 139.763 11.4297 139.689 11.9766L138.64 11.9824C138.691 11.459 138.851 10.9961 139.121 10.5938C139.394 10.1875 139.752 9.87695 140.193 9.66211C140.638 9.44336 141.121 9.33984 141.64 9.35156C142.347 9.36719 142.908 9.58203 143.322 9.99609C143.74 10.4062 143.92 10.9395 143.861 11.5957C143.795 12.3457 143.363 13.1348 142.566 13.9629L142.027 14.5078L139.285 17.1152H143.404L143.263 18Z" fill="white"/>
              </svg>`,
            width: 249,
            height: 333,
            absolutePosition: { x: 84, y: 160 }
          },
          header: { text: (offerDecoded.vendor || offerDecoded.issuer || ''), alignment: 'center', fontSize: 25, color: '#272727', margin: [0, 20, 0, 0] },
          content: [
            {
              svg: '<svg width="249" height="2" viewBox="0 0 249 2" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.283203" width="249" height="1" fill="#EAEAEA"/></svg>',
              width: 249,
              height: 40,
              alignment: 'center'
            },
            { text: offerDecoded.description ? offerDecoded.description.substring(0, 160) : '', alignment: 'center', fontSize: 16, color: '#5C5C5C' },
            { qr: selOffer.bolt12, eccLevel: 'M', fit: '227', alignment: 'center', absolutePosition: { x: 7, y: 205 } },
            { text: (!offerDecoded?.amount_msat || offerDecoded?.amount === 0 ? 'Open amount' : (this.decimalPipe.transform((offerDecoded.amount || 0) / 1000) + ' SATS')), fontSize: 20, bold: false, color: 'white', alignment: 'center', absolutePosition: { x: 0, y: 430 } },
            { text: 'SCAN TO PAY', fontSize: 22, bold: true, color: 'white', alignment: 'center', absolutePosition: { x: 0, y: 455 } }
          ],
          footer: {
            svg: `
              <svg width="183" height="15" viewBox="0 0 183 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.74609 7.52539L1.14258 11H0.427734L1.91016 2.46875L4.6875 2.47461C5.48438 2.49805 6.09961 2.73437 6.5332 3.18359C6.9668 3.62891 7.15039 4.22656 7.08398 4.97656C7.00586 5.77344 6.68359 6.39844 6.11719 6.85156C5.55078 7.30469 4.8125 7.53125 3.90234 7.53125L1.74609 7.52539ZM1.85156 6.91602L3.93164 6.92188C4.60742 6.92188 5.16406 6.75 5.60156 6.40625C6.03906 6.0625 6.29492 5.58789 6.36914 4.98242C6.43164 4.4043 6.30664 3.94922 5.99414 3.61719C5.68555 3.28125 5.24414 3.10547 4.66992 3.08984L2.51953 3.08398L1.85156 6.91602ZM7.58789 7.77148C7.6582 7.1582 7.8457 6.59766 8.15039 6.08984C8.45508 5.57812 8.83398 5.18945 9.28711 4.92383C9.74414 4.6582 10.2383 4.53125 10.7695 4.54297C11.293 4.55078 11.7383 4.69531 12.1055 4.97656C12.4766 5.25391 12.7461 5.63477 12.9141 6.11914C13.0859 6.59961 13.1445 7.13281 13.0898 7.71875L13.0781 7.83008C12.9609 8.83008 12.6055 9.63281 12.0117 10.2383C11.4219 10.8438 10.7129 11.1367 9.88477 11.1172C9.17383 11.1055 8.60547 10.8438 8.17969 10.332C7.75391 9.82031 7.54492 9.14453 7.55273 8.30469L7.57031 7.9707L7.58789 7.77148ZM8.26758 7.9707C8.2168 8.43555 8.25 8.86523 8.36719 9.25977C8.48828 9.65039 8.67969 9.95703 8.94141 10.1797C9.20312 10.4023 9.5293 10.5195 9.91992 10.5312C10.3418 10.5391 10.7266 10.4316 11.0742 10.209C11.4258 9.98633 11.7148 9.67188 11.9414 9.26562C12.168 8.85938 12.3145 8.41016 12.3809 7.91797L12.3984 7.72461C12.4688 6.9707 12.3516 6.35547 12.0469 5.87891C11.7461 5.39844 11.3086 5.15234 10.7344 5.14062C10.1094 5.12109 9.56836 5.36328 9.11133 5.86719C8.6582 6.36719 8.38086 7.0332 8.2793 7.86523L8.26758 7.9707ZM15.7383 9.54102V10.0391L15.9668 9.49414L18.2812 4.66016H18.8789L19.5059 9.50586L19.541 10.1035L19.7812 9.5L21.8789 4.66016H22.623L19.7285 11H19.1309L18.4336 5.97266L18.4277 5.62109L18.293 5.97852L15.8672 11H15.2695L14.5957 4.66016L15.252 4.6543L15.7383 9.54102ZM25.3535 11.1172C24.8457 11.1094 24.4062 10.9688 24.0352 10.6953C23.6641 10.418 23.3906 10.043 23.2148 9.57031C23.043 9.09375 22.9824 8.58008 23.0332 8.0293L23.0508 7.83008C23.1055 7.24414 23.2793 6.6875 23.5723 6.16016C23.8652 5.62891 24.2363 5.22461 24.6855 4.94727C25.1348 4.66602 25.6152 4.53125 26.127 4.54297C26.5996 4.55078 26.998 4.67969 27.3223 4.92969C27.6504 5.17969 27.8887 5.52734 28.0371 5.97266C28.1855 6.41797 28.2324 6.91016 28.1777 7.44922L28.1309 7.87695H23.7422L23.7246 8.01758C23.666 8.44336 23.6973 8.85156 23.8184 9.24219C23.9395 9.62891 24.1367 9.9375 24.4102 10.168C24.6875 10.3945 25.0195 10.5117 25.4062 10.5195C25.7812 10.5312 26.1191 10.459 26.4199 10.3027C26.7207 10.1465 26.998 9.9375 27.252 9.67578L27.6621 10.0098C27.377 10.377 27.0371 10.6562 26.6426 10.8477C26.252 11.0352 25.8223 11.125 25.3535 11.1172ZM26.0918 5.14062C25.584 5.12109 25.1289 5.30078 24.7266 5.67969C24.3242 6.05859 24.0215 6.5918 23.8184 7.2793L27.498 7.28516L27.5156 7.19727C27.5859 6.64258 27.4883 6.16602 27.2227 5.76758C26.957 5.36523 26.5801 5.15625 26.0918 5.14062ZM32.7832 5.25195C32.6309 5.2207 32.4766 5.20312 32.3203 5.19922C31.875 5.19922 31.4668 5.33594 31.0957 5.60938C30.7246 5.87891 30.4766 6.22266 30.3516 6.64062L29.6016 11H28.9102L30.0117 4.66016H30.6973L30.4863 5.66797C30.7168 5.29297 30.9941 5.00781 31.3184 4.8125C31.6465 4.61719 32.0059 4.52344 32.3965 4.53125C32.5332 4.53125 32.6934 4.55859 32.877 4.61328L32.7832 5.25195ZM35.2793 11.1172C34.7715 11.1094 34.332 10.9688 33.9609 10.6953C33.5898 10.418 33.3164 10.043 33.1406 9.57031C32.9688 9.09375 32.9082 8.58008 32.959 8.0293L32.9766 7.83008C33.0312 7.24414 33.2051 6.6875 33.498 6.16016C33.791 5.62891 34.1621 5.22461 34.6113 4.94727C35.0605 4.66602 35.541 4.53125 36.0527 4.54297C36.5254 4.55078 36.9238 4.67969 37.248 4.92969C37.5762 5.17969 37.8145 5.52734 37.9629 5.97266C38.1113 6.41797 38.1582 6.91016 38.1035 7.44922L38.0566 7.87695H33.668L33.6504 8.01758C33.5918 8.44336 33.623 8.85156 33.7441 9.24219C33.8652 9.62891 34.0625 9.9375 34.3359 10.168C34.6133 10.3945 34.9453 10.5117 35.332 10.5195C35.707 10.5312 36.0449 10.459 36.3457 10.3027C36.6465 10.1465 36.9238 9.9375 37.1777 9.67578L37.5879 10.0098C37.3027 10.377 36.9629 10.6562 36.5684 10.8477C36.1777 11.0352 35.748 11.125 35.2793 11.1172ZM36.0176 5.14062C35.5098 5.12109 35.0547 5.30078 34.6523 5.67969C34.25 6.05859 33.9473 6.5918 33.7441 7.2793L37.4238 7.28516L37.4414 7.19727C37.5117 6.64258 37.4141 6.16602 37.1484 5.76758C36.8828 5.36523 36.5059 5.15625 36.0176 5.14062ZM39.1172 7.8125C39.207 7.14844 39.3887 6.56055 39.6621 6.04883C39.9355 5.5332 40.2695 5.15039 40.6641 4.90039C41.0625 4.65039 41.5078 4.53125 42 4.54297C42.375 4.55078 42.7168 4.63867 43.0254 4.80664C43.334 4.9707 43.5781 5.2207 43.7578 5.55664L44.4023 2H45.0938L43.5293 11H42.8789L43.0371 10.1562C42.4863 10.8203 41.8027 11.1406 40.9863 11.1172C40.3965 11.1016 39.9336 10.873 39.5977 10.4316C39.2656 9.98633 39.0918 9.38867 39.0762 8.63867C39.0684 8.39648 39.0781 8.16211 39.1055 7.93555L39.1172 7.8125ZM39.8203 7.92969C39.7891 8.19141 39.7773 8.4707 39.7852 8.76758C39.8008 9.30273 39.9238 9.72461 40.1543 10.0332C40.3887 10.3379 40.7207 10.498 41.1504 10.5137C41.584 10.5254 41.9648 10.4258 42.293 10.2148C42.6211 10.0039 42.8984 9.72266 43.125 9.37109L43.6348 6.38281C43.5215 6.00391 43.334 5.70703 43.0723 5.49219C42.8145 5.27344 42.4844 5.1582 42.082 5.14648C41.4883 5.12695 40.9922 5.35547 40.5938 5.83203C40.1992 6.30469 39.9453 6.96289 39.832 7.80664L39.8203 7.92969ZM53.7656 7.85938C53.6289 8.86719 53.3066 9.66797 52.7988 10.2617C52.2949 10.8555 51.6699 11.1426 50.9238 11.123C50.5098 11.1152 50.1445 11.0234 49.8281 10.8477C49.5156 10.6719 49.2754 10.4336 49.1074 10.1328L48.9082 11H48.252L49.8164 2H50.5078L49.8457 5.58008C50.3887 4.86523 51.0742 4.51953 51.9023 4.54297C52.5078 4.55859 52.9746 4.7832 53.3027 5.2168C53.6309 5.65039 53.8008 6.25 53.8125 7.01562C53.8164 7.26562 53.8047 7.50586 53.7773 7.73633L53.7656 7.85938ZM53.0801 7.72461L53.1211 7.16797C53.1328 6.53125 53.0215 6.03906 52.7871 5.69141C52.5527 5.34375 52.2031 5.16211 51.7383 5.14648C50.8828 5.13086 50.2129 5.56445 49.7285 6.44727L49.248 9.31836C49.3613 9.69727 49.5547 9.99023 49.8281 10.1973C50.1055 10.4004 50.4414 10.5078 50.8359 10.5195C51.418 10.5312 51.9043 10.3066 52.2949 9.8457C52.6895 9.38086 52.9512 8.67383 53.0801 7.72461ZM56.8242 9.96875L59.5371 4.66016H60.3164L56.4492 12.0195C56.1641 12.5898 55.8613 12.9941 55.541 13.2324C55.2246 13.4707 54.8711 13.5859 54.4805 13.5781C54.332 13.5703 54.1445 13.5391 53.918 13.4844L53.9883 12.9102L54.3398 12.9512C54.9961 12.9785 55.5137 12.5918 55.8926 11.791L56.3379 10.9062L55.1133 4.66016H55.8457L56.8242 9.96875ZM66.9316 7.87695H65.5312V11H63.7734V2.46875H66.9434C67.9512 2.46875 68.7285 2.69336 69.2754 3.14258C69.8223 3.5918 70.0957 4.22656 70.0957 5.04688C70.0957 5.62891 69.9688 6.11523 69.7148 6.50586C69.4648 6.89258 69.084 7.20117 68.5723 7.43164L70.418 10.918V11H68.5312L66.9316 7.87695ZM65.5312 6.45312H66.9492C67.3906 6.45312 67.7324 6.3418 67.9746 6.11914C68.2168 5.89258 68.3379 5.58203 68.3379 5.1875C68.3379 4.78516 68.2227 4.46875 67.9922 4.23828C67.7656 4.00781 67.416 3.89258 66.9434 3.89258H65.5312V6.45312ZM73.1133 11H71.4141V4.66016H73.1133V11ZM71.3145 3.01953C71.3145 2.76563 71.3984 2.55664 71.5664 2.39258C71.7383 2.22852 71.9707 2.14648 72.2637 2.14648C72.5527 2.14648 72.7832 2.22852 72.9551 2.39258C73.127 2.55664 73.2129 2.76563 73.2129 3.01953C73.2129 3.27734 73.125 3.48828 72.9492 3.65234C72.7773 3.81641 72.5488 3.89844 72.2637 3.89844C71.9785 3.89844 71.748 3.81641 71.5723 3.65234C71.4004 3.48828 71.3145 3.27734 71.3145 3.01953ZM74.25 7.7832C74.25 6.79492 74.4707 6.00781 74.9121 5.42188C75.3574 4.83594 75.9648 4.54297 76.7344 4.54297C77.3516 4.54297 77.8613 4.77344 78.2637 5.23438V2H79.9629V11H78.4336L78.3516 10.3262C77.9297 10.8535 77.3867 11.1172 76.7227 11.1172C75.9766 11.1172 75.377 10.8242 74.9238 10.2383C74.4746 9.64844 74.25 8.83008 74.25 7.7832ZM75.9434 7.90625C75.9434 8.5 76.0469 8.95508 76.2539 9.27148C76.4609 9.58789 76.7617 9.74609 77.1562 9.74609C77.6797 9.74609 78.0488 9.52539 78.2637 9.08398V6.58203C78.0527 6.14062 77.6875 5.91992 77.168 5.91992C76.3516 5.91992 75.9434 6.58203 75.9434 7.90625ZM84.1934 11.1172C83.2637 11.1172 82.5059 10.832 81.9199 10.2617C81.3379 9.69141 81.0469 8.93164 81.0469 7.98242V7.81836C81.0469 7.18164 81.1699 6.61328 81.416 6.11328C81.6621 5.60938 82.0098 5.22266 82.459 4.95312C82.9121 4.67969 83.4277 4.54297 84.0059 4.54297C84.873 4.54297 85.5547 4.81641 86.0508 5.36328C86.5508 5.91016 86.8008 6.68555 86.8008 7.68945V8.38086H82.7637C82.8184 8.79492 82.9824 9.12695 83.2559 9.37695C83.5332 9.62695 83.8828 9.75195 84.3047 9.75195C84.957 9.75195 85.4668 9.51562 85.834 9.04297L86.666 9.97461C86.4121 10.334 86.0684 10.6152 85.6348 10.8184C85.2012 11.0176 84.7207 11.1172 84.1934 11.1172ZM84 5.91406C83.6641 5.91406 83.3906 6.02734 83.1797 6.25391C82.9727 6.48047 82.8398 6.80469 82.7812 7.22656H85.1367V7.0918C85.1289 6.7168 85.0273 6.42773 84.832 6.22461C84.6367 6.01758 84.3594 5.91406 84 5.91406ZM91.0605 8.0293H87.7617V6.66406H91.0605V8.0293ZM94.4473 3.10156V4.66016H95.5312V5.90234H94.4473V9.06641C94.4473 9.30078 94.4922 9.46875 94.582 9.57031C94.6719 9.67188 94.8438 9.72266 95.0977 9.72266C95.2852 9.72266 95.4512 9.70898 95.5957 9.68164V10.9648C95.2637 11.0664 94.9219 11.1172 94.5703 11.1172C93.3828 11.1172 92.7773 10.5176 92.7539 9.31836V5.90234H91.8281V4.66016H92.7539V3.10156H94.4473ZM98.127 5.35156C98.5762 4.8125 99.1406 4.54297 99.8203 4.54297C101.195 4.54297 101.893 5.3418 101.912 6.93945V11H100.219V6.98633C100.219 6.62305 100.141 6.35547 99.9844 6.18359C99.8281 6.00781 99.5684 5.91992 99.2051 5.91992C98.709 5.91992 98.3496 6.11133 98.127 6.49414V11H96.4336V2H98.127V5.35156ZM106.107 11.1172C105.178 11.1172 104.42 10.832 103.834 10.2617C103.252 9.69141 102.961 8.93164 102.961 7.98242V7.81836C102.961 7.18164 103.084 6.61328 103.33 6.11328C103.576 5.60938 103.924 5.22266 104.373 4.95312C104.826 4.67969 105.342 4.54297 105.92 4.54297C106.787 4.54297 107.469 4.81641 107.965 5.36328C108.465 5.91016 108.715 6.68555 108.715 7.68945V8.38086H104.678C104.732 8.79492 104.896 9.12695 105.17 9.37695C105.447 9.62695 105.797 9.75195 106.219 9.75195C106.871 9.75195 107.381 9.51562 107.748 9.04297L108.58 9.97461C108.326 10.334 107.982 10.6152 107.549 10.8184C107.115 11.0176 106.635 11.1172 106.107 11.1172ZM105.914 5.91406C105.578 5.91406 105.305 6.02734 105.094 6.25391C104.887 6.48047 104.754 6.80469 104.695 7.22656H107.051V7.0918C107.043 6.7168 106.941 6.42773 106.746 6.22461C106.551 6.01758 106.273 5.91406 105.914 5.91406ZM112.975 8.0293H109.676V6.66406H112.975V8.0293ZM116.203 9.58789H119.936V11H114.445V2.46875H116.203V9.58789ZM122.625 11H120.926V4.66016H122.625V11ZM120.826 3.01953C120.826 2.76563 120.91 2.55664 121.078 2.39258C121.25 2.22852 121.482 2.14648 121.775 2.14648C122.064 2.14648 122.295 2.22852 122.467 2.39258C122.639 2.55664 122.725 2.76563 122.725 3.01953C122.725 3.27734 122.637 3.48828 122.461 3.65234C122.289 3.81641 122.061 3.89844 121.775 3.89844C121.49 3.89844 121.26 3.81641 121.084 3.65234C120.912 3.48828 120.826 3.27734 120.826 3.01953ZM123.779 7.7832C123.779 6.81055 124.01 6.02734 124.471 5.43359C124.936 4.83984 125.561 4.54297 126.346 4.54297C127.041 4.54297 127.582 4.78125 127.969 5.25781L128.039 4.66016H129.574V10.7891C129.574 11.3438 129.447 11.8262 129.193 12.2363C128.943 12.6465 128.59 12.959 128.133 13.1738C127.676 13.3887 127.141 13.4961 126.527 13.4961C126.062 13.4961 125.609 13.4023 125.168 13.2148C124.727 13.0312 124.393 12.793 124.166 12.5L124.916 11.4688C125.338 11.9414 125.85 12.1777 126.451 12.1777C126.9 12.1777 127.25 12.0566 127.5 11.8145C127.75 11.5762 127.875 11.2363 127.875 10.7949V10.4551C127.484 10.8965 126.971 11.1172 126.334 11.1172C125.572 11.1172 124.955 10.8203 124.482 10.2266C124.014 9.62891 123.779 8.83789 123.779 7.85352V7.7832ZM125.473 7.90625C125.473 8.48047 125.588 8.93164 125.818 9.25977C126.049 9.58398 126.365 9.74609 126.768 9.74609C127.283 9.74609 127.652 9.55273 127.875 9.16602V6.5C127.648 6.11328 127.283 5.91992 126.779 5.91992C126.373 5.91992 126.053 6.08594 125.818 6.41797C125.588 6.75 125.473 7.24609 125.473 7.90625ZM132.533 5.35156C132.982 4.8125 133.547 4.54297 134.227 4.54297C135.602 4.54297 136.299 5.3418 136.318 6.93945V11H134.625V6.98633C134.625 6.62305 134.547 6.35547 134.391 6.18359C134.234 6.00781 133.975 5.91992 133.611 5.91992C133.115 5.91992 132.756 6.11133 132.533 6.49414V11H130.84V2H132.533V5.35156ZM139.623 3.10156V4.66016H140.707V5.90234H139.623V9.06641C139.623 9.30078 139.668 9.46875 139.758 9.57031C139.848 9.67188 140.02 9.72266 140.273 9.72266C140.461 9.72266 140.627 9.70898 140.771 9.68164V10.9648C140.439 11.0664 140.098 11.1172 139.746 11.1172C138.559 11.1172 137.953 10.5176 137.93 9.31836V5.90234H137.004V4.66016H137.93V3.10156H139.623ZM143.209 4.66016L143.262 5.39258C143.715 4.82617 144.322 4.54297 145.084 4.54297C145.756 4.54297 146.256 4.74023 146.584 5.13477C146.912 5.5293 147.08 6.11914 147.088 6.9043V11H145.395V6.94531C145.395 6.58594 145.316 6.32617 145.16 6.16602C145.004 6.00195 144.744 5.91992 144.381 5.91992C143.904 5.91992 143.547 6.12305 143.309 6.5293V11H141.615V4.66016H143.209ZM150.164 11H148.465V4.66016H150.164V11ZM148.365 3.01953C148.365 2.76563 148.449 2.55664 148.617 2.39258C148.789 2.22852 149.021 2.14648 149.314 2.14648C149.604 2.14648 149.834 2.22852 150.006 2.39258C150.178 2.55664 150.264 2.76563 150.264 3.01953C150.264 3.27734 150.176 3.48828 150 3.65234C149.828 3.81641 149.6 3.89844 149.314 3.89844C149.029 3.89844 148.799 3.81641 148.623 3.65234C148.451 3.48828 148.365 3.27734 148.365 3.01953ZM153.123 4.66016L153.176 5.39258C153.629 4.82617 154.236 4.54297 154.998 4.54297C155.67 4.54297 156.17 4.74023 156.498 5.13477C156.826 5.5293 156.994 6.11914 157.002 6.9043V11H155.309V6.94531C155.309 6.58594 155.23 6.32617 155.074 6.16602C154.918 6.00195 154.658 5.91992 154.295 5.91992C153.818 5.91992 153.461 6.12305 153.223 6.5293V11H151.529V4.66016H153.123ZM158.045 7.7832C158.045 6.81055 158.275 6.02734 158.736 5.43359C159.201 4.83984 159.826 4.54297 160.611 4.54297C161.307 4.54297 161.848 4.78125 162.234 5.25781L162.305 4.66016H163.84V10.7891C163.84 11.3438 163.713 11.8262 163.459 12.2363C163.209 12.6465 162.855 12.959 162.398 13.1738C161.941 13.3887 161.406 13.4961 160.793 13.4961C160.328 13.4961 159.875 13.4023 159.434 13.2148C158.992 13.0312 158.658 12.793 158.432 12.5L159.182 11.4688C159.604 11.9414 160.115 12.1777 160.717 12.1777C161.166 12.1777 161.516 12.0566 161.766 11.8145C162.016 11.5762 162.141 11.2363 162.141 10.7949V10.4551C161.75 10.8965 161.236 11.1172 160.6 11.1172C159.838 11.1172 159.221 10.8203 158.748 10.2266C158.279 9.62891 158.045 8.83789 158.045 7.85352V7.7832ZM159.738 7.90625C159.738 8.48047 159.854 8.93164 160.084 9.25977C160.314 9.58398 160.631 9.74609 161.033 9.74609C161.549 9.74609 161.918 9.55273 162.141 9.16602V6.5C161.914 6.11328 161.549 5.91992 161.045 5.91992C160.639 5.91992 160.318 6.08594 160.084 6.41797C159.854 6.75 159.738 7.24609 159.738 7.90625Z" fill="#5C5C5C"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M180.233 2.8383C180.3 2.99917 180.326 3.12628 180.322 3.19621C180.066 3.03702 179.68 2.90169 179.47 2.8629C179.333 2.8376 179.781 2.72551 180.233 2.8383ZM180.606 8.75656C180.685 8.73926 180.765 8.72273 180.845 8.70662C180.928 8.68974 181.012 8.67356 181.096 8.65828C181.028 8.6146 180.961 8.57133 180.893 8.52873C180.029 7.98743 179.109 7.5278 178.199 7.08296C177.625 6.80221 177.041 6.52314 176.446 6.27161C176.965 5.56601 177.63 4.96718 178.34 4.45423C178.341 4.45381 178.344 4.45175 178.348 4.4485C178.504 4.66718 178.7 4.81599 178.799 4.87191C178.992 4.9813 179.234 5.08353 179.458 5.11478C179.896 5.17625 180.259 5.16678 180.66 5.09559C180.696 5.08919 180.732 5.08465 180.768 5.07843C181.025 5.03415 181.19 5.02744 181.34 5.02454C181.54 5.02069 181.639 5.0642 181.662 5.07049C181.733 5.08947 181.794 5.12089 181.828 5.16304C181.867 5.21435 181.908 5.26275 181.953 5.30707C182.087 5.44466 182.221 5.52085 182.414 5.5427C182.663 5.5708 182.839 5.47053 182.963 5.30406C183.022 5.22546 182.994 5.10202 182.988 5.0778C182.955 4.95397 182.879 4.77384 182.825 4.60615C182.811 4.56282 182.742 4.42959 182.66 4.33917C182.632 4.30926 182.605 4.27941 182.578 4.2496C182.45 4.10997 182.32 3.9714 182.192 3.83188C181.681 3.27555 181.128 2.76333 180.557 2.27358C180.498 2.22283 180.438 2.17195 180.379 2.12116C180.336 2.08429 180.293 2.04763 180.25 2.0109C180.228 1.99223 180.206 1.97361 180.184 1.95498C180.137 1.91563 180.091 1.87655 180.044 1.83751C180.026 1.82213 180.007 1.80686 179.989 1.79152C179.96 1.7674 179.893 1.70984 179.837 1.66374C180.023 1.47355 180.172 1.35514 180.437 1.17609C180.475 1.15044 180.68 1.03783 180.673 1.00924C180.669 0.991976 180.332 0.99589 179.947 1.04706C179.811 1.06502 179.052 1.18049 178.531 1.29751C177.976 1.42203 177.39 1.59612 176.851 1.77111C175.292 2.27662 173.804 2.9617 172.441 3.89276C171.658 4.42784 170.925 5.01831 170.217 5.6545C169.888 5.95091 169.56 6.25207 169.24 6.56155C169.19 6.61003 169.14 6.65892 169.09 6.70785C169.158 6.72099 169.226 6.73473 169.294 6.74913C169.858 6.86837 170.415 7.02774 170.957 7.18732C171.62 7.38248 172.291 7.59288 172.939 7.85116C172.569 8.21327 172.209 8.5843 171.866 8.97692C171.22 9.71614 170.617 10.4971 170.055 11.3058C169.323 12.3594 168.698 13.4958 168.153 14.6668C168.101 14.7776 168.05 14.8887 168 15C168.101 14.9169 168.202 14.8344 168.304 14.7528C169.187 14.0478 170.117 13.396 171.046 12.7662C172.353 11.88 173.756 11.148 175.211 10.5589C176.966 9.8487 178.758 9.15974 180.606 8.75656Z" fill="#5C5C5C"/>
              </svg>
            `,
            alignment: 'center'
          }
        };
        pdfMake.createPdf(documentDefinition, null, null, pdfFonts.pdfMake.vfs).download('Offer-' + (offerDecoded && offerDecoded.description ? offerDecoded.description : selOffer.bolt12));
      });
  }

  applyFilter() {
    this.offers.filter = this.selFilter.trim().toLowerCase();
  }

  getLabel(column: string) {
    const returnColumn: ColumnDefinition = this.nodePageDefs[this.PAGE_ID][this.tableSetting.tableId].allowedColumns.find((col) => col.column === column);
    return returnColumn ? returnColumn.label ? returnColumn.label : this.camelCaseWithReplace.transform(returnColumn.column, '_') : 'all';
  }

  setFilterPredicate() {
    this.offers.filterPredicate = (rowData: Offer, fltr: string) => {
      const newRowData = ((rowData.active) ? ' active' : ' inactive') + ((rowData.used) ? ' used' : ' unused') + ((rowData.single_use) ? ' single' : ' multiple') + JSON.stringify(rowData).toLowerCase();
      if (fltr === 'active' || fltr === 'inactive' || fltr === 'used' || fltr === 'unused' || fltr === 'single' || fltr === 'multiple') {
        fltr = ' ' + fltr;
      }
      return newRowData.includes(fltr);
    };
    // this.offers.filterPredicate = (rowData: Offer, fltr: string) => {
    //   let rowToFilter = '';
    //   switch (this.selFilterBy) {
    //     case 'all':
    //       for (let i = 0; i < this.displayedColumns.length - 1; i++) {
    //         rowToFilter = rowToFilter + (
    //           (this.displayedColumns[i] === '') ?
    //             (rowData ? rowData..toLowerCase() : '') :
    //             (rowData[this.displayedColumns[i]] ? rowData[this.displayedColumns[i]].toLowerCase() : '')
    //         ) + ', ';
    //       }
    //       break;

    //     case '':
    //       rowToFilter = (rowData ? rowData..toLowerCase() : '');
    //       break;

    //     default:
    //       rowToFilter = (rowData[this.selFilterBy] ? rowData[this.selFilterBy].toLowerCase() : '');
    //       break;
    //   }
    //   return rowToFilter.includes(fltr);
    // };
  }

  loadOffersTable(offrs: Offer[]) {
    this.offers = (offrs) ? new MatTableDataSource<Offer>([...offrs]) : new MatTableDataSource([]);
    this.offers.sortingDataAccessor = (data: any, sortHeaderId: string) => ((data[sortHeaderId] && isNaN(data[sortHeaderId])) ? data[sortHeaderId].toLocaleLowerCase() : data[sortHeaderId] ? +data[sortHeaderId] : null);
    this.offers.sort = this.sort;
    this.offers.sort?.sort({ id: this.tableSetting.sortBy, start: this.tableSetting.sortOrder, disableClear: true });
    this.offers.paginator = this.paginator;
    this.setFilterPredicate();
    this.applyFilter();
  }

  onDownloadCSV() {
    if (this.offers.data && this.offers.data.length > 0) {
      this.commonService.downloadFile(this.offers.data, 'Offers');
    }
  }

  ngOnDestroy() {
    this.unSubs.forEach((completeSub) => {
      completeSub.next(<any>null);
      completeSub.complete();
    });
  }

}
