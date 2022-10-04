import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useCallback} from 'react';
import {useAppDispatch} from '../../../utils/hooks';
import Button from '../../../components/button/Button';
import {
  ScrollView,
  WalletConnectContainer,
} from '../styled/WalletConnectContainers';
import {useTranslation} from 'react-i18next';
import {Controller, useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import yup from '../../../lib/yup';
import {ImportTextInput} from '../../../components/styled/Containers';
import {Wallet} from '../../../store/wallet/wallet.models';
import {
  dismissOnGoingProcessModal,
  showBottomNotificationModal,
  showOnGoingProcessModal,
} from '../../../store/app/app.actions';
import {OnGoingProcessMessages} from '../../../components/modal/ongoing-process/OngoingProcess';
import {walletConnectOnSessionRequest} from '../../../store/wallet-connect/wallet-connect.effects';
import {sleep} from '../../../utils/helper-methods';
import {CustomErrorMessage} from '../../wallet/components/ErrorMessages';
import {BWCErrorMessage} from '../../../constants/BWCError';
import {BottomNotificationConfig} from '../../../components/modal/bottom-notification/BottomNotification';

export type WalletConnectAuxParamList = {
  wallet?: Wallet;
};

const schema = yup.object().shape({
  text: yup.string().required(),
});

const WalletConnectAux = () => {
  const {t} = useTranslation();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const route = useRoute<RouteProp<{params: WalletConnectAuxParamList}>>();
  const {wallet} = route.params || {};

  const showErrorMessage = useCallback(
    async (msg: BottomNotificationConfig) => {
      await sleep(500);
      dispatch(showBottomNotificationModal(msg));
    },
    [dispatch],
  );

  const {control, handleSubmit} = useForm({resolver: yupResolver(schema)});

  const onSubmit = (formData: {text: string}) => {
    const {text} = formData;
    goToStartView(wallet!, text);
  };

  const goToStartView = useCallback(
    async (wallet: Wallet, wcUri: string) => {
      try {
        dispatch(
          showOnGoingProcessModal(
            // t('Loading')
            t(OnGoingProcessMessages.LOADING),
          ),
        );
        const peer = (await dispatch<any>(
          walletConnectOnSessionRequest(wcUri),
        )) as any;
        dispatch(dismissOnGoingProcessModal());
        await sleep(500);
        navigation.navigate('WalletConnect', {
          screen: 'WalletConnectStart',
          params: {
            keyId: wallet.keyId,
            walletId: wallet.id,
            peer,
          },
        });
      } catch (e) {
        dispatch(dismissOnGoingProcessModal());
        await sleep(500);
        await showErrorMessage(
          CustomErrorMessage({
            errMsg: BWCErrorMessage(e),
            title: t('Uh oh, something went wrong'),
          }),
        );
      }
    },
    [dispatch, navigation, showErrorMessage, t],
  );

  return (
    <WalletConnectContainer>
      <ScrollView>
        <Controller
          control={control}
          render={({field: {onChange, onBlur, value}}) => (
            <ImportTextInput
              style={{marginBottom: 20}}
              autoCapitalize={'none'}
              numberOfLines={1}
              onChangeText={(text: string) => onChange(text)}
              onBlur={onBlur}
              value={value}
              autoCorrect={false}
              spellCheck={false}
            />
          )}
          name="text"
          defaultValue=""
        />
        <Button buttonStyle={'primary'} onPress={handleSubmit(onSubmit)}>
          {t('Connect')}
        </Button>
      </ScrollView>
    </WalletConnectContainer>
  );
};

export default WalletConnectAux;
