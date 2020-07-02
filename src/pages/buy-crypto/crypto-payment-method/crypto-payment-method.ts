import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NavController, NavParams, ViewController } from 'ionic-angular';
import * as _ from 'lodash';

// Providers
import { BuyCryptoProvider } from '../../../providers/buy-crypto/buy-crypto';
import { Logger } from '../../../providers/logger/logger';
import { PlatformProvider } from '../../../providers/platform/platform';

// Pages
import { CryptoOrderSummaryPage } from '../../../pages/buy-crypto/crypto-order-summary/crypto-order-summary';
export interface PaymentMethod {
  label: any;
  method: string;
  imgSrc: string;
  simplexSupport: boolean;
  wyreSupport: boolean;
  enabled: boolean;
}
@Component({
  selector: 'page-crypto-payment-method',
  templateUrl: 'crypto-payment-method.html'
})
export class CryptoPaymentMethodPage {
  public methods: { [key: string]: PaymentMethod };
  public methodSelected: string;
  public paymentRequest;
  public useAsModal: boolean;
  public isIOS: boolean;
  private coin: string;
  private currency: string;

  constructor(
    private logger: Logger,
    private navParams: NavParams,
    private translate: TranslateService,
    private navCtrl: NavController,
    private viewCtrl: ViewController,
    private platformProvider: PlatformProvider,
    private buyCryptoProvider: BuyCryptoProvider
  ) {
    this.coin = this.navParams.data.coin;
    this.currency = this.navParams.data.currency;
    this.methods = {
      applePay: {
        label: this.translate.instant('Apple Pay'),
        method: 'applePay',
        imgSrc: 'assets/img/buy-crypto/apple-pay.svg',
        simplexSupport: false,
        wyreSupport: this.isSupported('wyre'),
        enabled: this.platformProvider.isIOS
      },
      creditCard: {
        label: this.translate.instant('Credit Card'),
        method: 'creditCard',
        imgSrc: 'assets/img/buy-crypto/debit-card.svg',
        simplexSupport: this.isSupported('simplex'),
        wyreSupport: false,
        enabled: true
      },
      debitCard: {
        label: this.translate.instant('Debit Card'),
        method: 'debitCard',
        imgSrc: 'assets/img/buy-crypto/debit-card.svg',
        simplexSupport: this.isSupported('simplex'),
        wyreSupport: this.isSupported('wyre'),
        enabled: true
      }
    };
  }

  ionViewDidLoad() {
    this.logger.info('Loaded: CryptoPaymentMethodPage');
    this.methods = _.pickBy(this.methods, m => m.enabled);
  }

  ionViewWillEnter() {
    this.useAsModal = this.navParams.data.useAsModal;
    if (!this.methodSelected)
      this.methodSelected = this.navParams.data.paymentMethod || 'creditCard';
  }

  public goToOrderSummary(): void {
    const params = {
      coin: this.coin,
      currency: this.currency,
      network: this.navParams.data.network,
      walletId: this.navParams.data.walletId,
      paymentMethod: this.methods[this.methodSelected],
      amount: this.navParams.data.amount
    };
    this.navCtrl.push(CryptoOrderSummaryPage, params);
  }

  public close() {
    this.viewCtrl.dismiss();
  }

  public save() {
    if (
      !this.useAsModal ||
      !this.methodSelected ||
      this.navParams.data.paymentMethod == this.methodSelected
    )
      return;
    this.viewCtrl.dismiss({ paymentMethod: this.methods[this.methodSelected] });
  }

  private isSupported(exchange: string): boolean {
    return this.buyCryptoProvider.isExchangeSupported(
      exchange,
      this.coin,
      this.currency
    );
  }
}