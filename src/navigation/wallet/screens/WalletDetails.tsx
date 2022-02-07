import {useNavigation, useTheme} from '@react-navigation/native';
import {StackScreenProps} from '@react-navigation/stack';
import React, {useLayoutEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {FlatList, RefreshControl} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components/native';
import Settings from '../../../components/settings/Settings';
import {
  Balance,
  BaseText,
  H5,
  HeaderTitle,
} from '../../../components/styled/Text';
import {Network} from '../../../constants';
import {SUPPORTED_CURRENCIES} from '../../../constants/currencies';
import {RootState} from '../../../store';
import {showBottomNotificationModal} from '../../../store/app/app.actions';
import {startUpdateWalletBalance} from '../../../store/wallet/effects/balance/balance';
import {findWalletById} from '../../../store/wallet/utils/wallet';
import {updatePortfolioBalance} from '../../../store/wallet/wallet.actions';
import {Wallet} from '../../../store/wallet/wallet.models';
import {SlateDark, White} from '../../../styles/colors';
import {sleep} from '../../../utils/helper-methods';
import LinkingButtons from '../../tabs/home/components/LinkingButtons';
import {BalanceUpdateError} from '../components/ErrorMessages';
import OptionsBottomPopupModal, {
  Option,
} from '../components/OptionsBottomPopupModal';
import ReceiveAddress from '../components/ReceiveAddress';
import Icons from '../components/WalletIcons';
import {WalletStackParamList} from '../WalletStack';
import {buildUIFormattedWallet} from './KeyOverview';

type WalletDetailsScreenProps = StackScreenProps<
  WalletStackParamList,
  'WalletDetails'
>;

const WalletDetailsContainer = styled.View`
  flex: 1;
`;

const Row = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
`;

const BalanceContainer = styled.View`
  margin-top: 20px;
  padding: 10px 15px;
  flex-direction: column;
`;

const Chain = styled(BaseText)`
  font-size: 14px;
  font-style: normal;
  font-weight: 300;
  letter-spacing: 0;
  line-height: 40px;
`;

const WalletDetails: React.FC<WalletDetailsScreenProps> = ({route}) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const {t} = useTranslation();
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const {walletId, key} = route.params;
  const fullWalletObj = useSelector(({WALLET}: RootState) =>
    findWalletById(WALLET.keys[key.id].wallets, walletId),
  ) as Wallet;
  const uiFormattedWallet = buildUIFormattedWallet(fullWalletObj);
  const [showReceiveAddressBottomModal, setShowReceiveAddressBottomModal] =
    useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitle>{uiFormattedWallet.currencyName}</HeaderTitle>
      ),
      headerRight: () => (
        <Settings
          onPress={() => {
            setShowWalletOptions(true);
          }}
        />
      ),
    });
  }, [navigation, uiFormattedWallet.currencyName]);

  const assetOptions: Array<Option> = [
    {
      img: <Icons.RequestAmount />,
      title: 'Request a specific amount',
      description:
        'This will generate an invoice, which the person you send it to can pay using any wallet.',
      onPress: () => null,
    },
    {
      img: <Icons.ShareAddress />,
      title: 'Share Address',
      description:
        'Share your wallet address to someone in your contacts so they can send you funds.',
      onPress: () => null,
    },
    {
      img: <Icons.Settings />,
      title: 'Wallet Settings',
      description: 'View all the ways to manage and configure your wallet.',
      onPress: () =>
        navigation.navigate('Wallet', {
          screen: 'WalletSettings',
          params: {
            wallet: uiFormattedWallet,
          },
        }),
    },
  ];

  const showReceiveAddress = () => {
    setShowReceiveAddressBottomModal(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await sleep(1000);

    try {
      await Promise.all([
        await dispatch(startUpdateWalletBalance({key, wallet: fullWalletObj})),
        sleep(1000),
      ]);
      dispatch(updatePortfolioBalance());
    } catch (err) {
      dispatch(showBottomNotificationModal(BalanceUpdateError));
    }
    setRefreshing(false);
  };

  const {
    cryptoBalance,
    fiatBalance,
    currencyName,
    currencyAbbreviation,
    network,
  } = uiFormattedWallet;

  const showFiatBalance =
    SUPPORTED_CURRENCIES.includes(currencyAbbreviation.toLowerCase()) &&
    network !== Network.testnet;

  return (
    <WalletDetailsContainer>
      <FlatList
        refreshControl={
          <RefreshControl
            tintColor={theme.dark ? White : SlateDark}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={() => {
          return (
            <>
              <BalanceContainer>
                <Row>
                  <Balance>
                    {cryptoBalance} {currencyAbbreviation}
                  </Balance>
                  <Chain>{currencyAbbreviation}</Chain>
                </Row>
                {showFiatBalance && <H5>{fiatBalance}</H5>}
              </BalanceContainer>

              <LinkingButtons
                receiveCta={() => showReceiveAddress()}
                sendCta={() => null}
              />
            </>
          );
        }}
      />

      <OptionsBottomPopupModal
        isVisible={showWalletOptions}
        closeModal={() => setShowWalletOptions(false)}
        title={t('ReceiveCurrency', {currency: currencyName})}
        options={assetOptions}
      />

      <ReceiveAddress
        isVisible={showReceiveAddressBottomModal}
        closeModal={() => setShowReceiveAddressBottomModal(false)}
        wallet={fullWalletObj}
      />
    </WalletDetailsContainer>
  );
};

export default WalletDetails;