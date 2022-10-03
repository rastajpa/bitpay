import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components/native';
import {
  CtaContainer,
  HeaderRightContainer,
  ScreenGutter,
} from '../../../components/styled/Containers';
import CurrencySelectionRow, {
  CurrencySelectionItem,
  CurrencySelectionRowProps,
} from '../../../components/list/CurrencySelectionRow';

import Button from '../../../components/button/Button';
import {
  BitpaySupportedCurrencies,
  BitpaySupportedTokens,
} from '../../../constants/currencies';
import {startCreateKey} from '../../../store/wallet/effects';
import {
  FlatList,
  ImageRequireSource,
  ImageSourcePropType,
  ListRenderItem,
} from 'react-native';
import {
  logSegmentEvent,
  startOnGoingProcessModal,
} from '../../../store/app/app.effects';
import {OnGoingProcessMessages} from '../../../components/modal/ongoing-process/OngoingProcess';
import {useNavigation} from '@react-navigation/native';
import {HeaderTitle} from '../../../components/styled/Text';
import haptic from '../../../components/haptic-feedback/haptic';
import {
  SupportedCoinsOptions,
  SupportedCurrencyOption,
  SupportedCurrencyOptions,
  SupportedTokenOptions,
} from '../../../constants/SupportedCurrencyOptions';
import {WalletScreens, WalletStackParamList} from '../WalletStack';
import {
  dismissOnGoingProcessModal,
  setHomeCarouselConfig,
  showBottomNotificationModal,
} from '../../../store/app/app.actions';
import {Key, Token} from '../../../store/wallet/wallet.models';
import {StackScreenProps} from '@react-navigation/stack';
import {getCurrencyAbbreviation, sleep} from '../../../utils/helper-methods';
import {useLogger} from '../../../utils/hooks/useLogger';
import {useAppSelector, useAppDispatch} from '../../../utils/hooks';
import {BitpaySupportedTokenOpts} from '../../../constants/tokens';
import {useTranslation} from 'react-i18next';
import CurrencySelectionSearchInput from '../components/CurrencySelectionSearchInput';
import CurrencySelectionNoResults from '../components/CurrencySelectionNoResults';
import {orderBy} from 'lodash';

type CurrencySelectionScreenProps = StackScreenProps<
  WalletStackParamList,
  WalletScreens.CURRENCY_SELECTION
>;

type CurrencySelectionContextWithoutKey = 'onboarding' | 'createNewKey';
type CurrencySelectionContextWithKey = 'addWallet' | 'addWalletMultisig';
export type CurrencySelectionParamList =
  | {
      context: CurrencySelectionContextWithoutKey;
      key?: undefined;
    }
  | {
      context: CurrencySelectionContextWithKey;
      key: Key;
    };

type CurrencySelectionListItem = CurrencySelectionRowProps & {
  /**
   * All tokens for this chain currency.
   */
  tokens: CurrencySelectionItem[];

  /**
   * Popular tokens for this chain currency. Needs to be kept in sync with tokens.
   * Using a separate property instead of deriving due to performance reasons.
   */
  popularTokens: CurrencySelectionItem[];
};

export type CurrencySelectionMode = 'single' | 'multi';

interface ContextHandler {
  headerTitle?: string;
  ctaTitle?: string;
  onCtaPress?: () => void;
  selectionMode: CurrencySelectionMode;
}

export const CurrencySelectionContainer = styled.View`
  flex: 1;
`;

const ListContainer = styled.View`
  flex-shrink: 1;
`;

export const SearchContainer = styled.View`
  align-items: center;
  padding: 4px 0;
  margin: 20px ${ScreenGutter} 20px;
`;

const SupportedMultisigCurrencyOptions: SupportedCurrencyOption[] =
  SupportedCurrencyOptions.filter(currency => {
    return currency.hasMultisig;
  });

const DESCRIPTIONS: Record<string, string> = {
  eth: 'TokensOnEthereumNetworkDescription',
  matic: 'TokensOnPolygonNetworkDescription',
};

const POPULAR_TOKENS: Record<string, string[]> = {
  eth: ['usdc', 'busd', 'ape'],
  matic: ['usdc', 'busd', 'ape'],
};

const keyExtractor = (item: CurrencySelectionListItem) => item.currency.id;

const CurrencySelection: React.VFC<CurrencySelectionScreenProps> = ({
  route,
}) => {
  const {t} = useTranslation();
  const navigation = useNavigation();
  const {context, key} = route.params;
  const logger = useLogger();
  const dispatch = useAppDispatch();
  const [searchFilter, setSearchFilter] = useState('');
  const appTokenOptions = useAppSelector(({WALLET}) => WALLET.tokenOptions);
  const appTokenData = useAppSelector(({WALLET}) => WALLET.tokenData);
  const appCustomTokenOptions = useAppSelector(
    ({WALLET}) => WALLET.customTokenOptions,
  );
  const appCustomTokenData = useAppSelector(
    ({WALLET}) => WALLET.customTokenData,
  );

  /**
   * Source of truth for which currencies are selected.
   */
  const [allListItems, setAllListItems] = useState<CurrencySelectionListItem[]>(
    [],
  );
  const allListItemsRef = useRef(allListItems);
  allListItemsRef.current = allListItems;

  /**
   * Derived from allListItems, but with search filter applied.
   */
  const filteredListItems = useMemo(() => {
    // If no filter, return reference to allListItems.
    if (!searchFilter) {
      return allListItems;
    }

    // Else return a new array to trigger a rerender.
    return allListItems.reduce<CurrencySelectionListItem[]>((accum, item) => {
      const isCurrencyMatch =
        item.currency.currencyAbbreviation
          .toLowerCase()
          .includes(searchFilter) ||
        item.currency.currencyName.toLowerCase().includes(searchFilter);
      const matchingTokens = item.popularTokens.filter(
        token =>
          token.currencyAbbreviation.toLowerCase().includes(searchFilter) ||
          token.currencyName.toLowerCase().includes(searchFilter),
      );

      // Display the item if the currency itself matches the filter or one of its tokens matches
      if (isCurrencyMatch || matchingTokens.length) {
        accum.push({
          ...item,
          popularTokens: matchingTokens,
        });
      }

      return accum;
    }, []);
  }, [searchFilter, allListItems]);

  // Initialize supported currencies and tokens into row item format.
  // Resets if tokenOptions or tokenData updates.
  useEffect(() => {
    if (context === 'addWalletMultisig') {
      const items = SupportedMultisigCurrencyOptions.map(currency => {
        const item: CurrencySelectionListItem = {
          currency: {
            ...currency,
            imgSrc: undefined,
            selected: false,
            disabled: false,
            chain: currency.currencyAbbreviation,
          },
          tokens: [],
          popularTokens: [],
        };

        return item;
      });

      setAllListItems(items);
      return;
    }

    const chainMap: Record<string, CurrencySelectionListItem> = {};

    // Add all chain currencies to list
    const list: CurrencySelectionListItem[] = SupportedCoinsOptions.map(
      ({id, currencyAbbreviation, currencyName, img}) => {
        const chain = currencyAbbreviation.toLowerCase();
        const item: CurrencySelectionListItem = {
          currency: {
            id,
            currencyAbbreviation,
            currencyName,
            img,
            selected: false,
            disabled: false,
            chain: chain,
          },
          tokens: [],
          popularTokens: [],
          description: DESCRIPTIONS[chain] ? t(DESCRIPTIONS[chain]) : '',
        };

        chainMap[chain] = item;

        return item;
      },
    );

    // For each token, add it to the token list for its parent chain object
    const tokenOptions: Record<string, Token> = {
      ...BitpaySupportedTokenOpts,
      ...appTokenOptions,
      ...appCustomTokenOptions,
    };

    Object.entries(tokenOptions).forEach(([k, tokenOpt]) => {
      if (
        !(
          BitpaySupportedCurrencies[k] ||
          appTokenData[k] ||
          appCustomTokenData[k]
        ) ||
        k === 'pax'
      ) {
        return;
      }

      const tokenData =
        BitpaySupportedCurrencies[k] ||
        appTokenData[k] ||
        appCustomTokenData[k];
      const chainData = chainMap[tokenData.chain.toLowerCase()];
      const imgSrc = SupportedTokenOptions.find(
        c =>
          getCurrencyAbbreviation(c.currencyAbbreviation, tokenData.chain) ===
          k,
      )?.imgSrc;
      const isReqSrc = (
        src: ImageSourcePropType | undefined,
      ): src is ImageRequireSource => typeof src === 'number';

      const token: CurrencySelectionItem = {
        id: k,
        currencyAbbreviation: tokenOpt.symbol,
        currencyName: tokenOpt.name,
        img: tokenOpt.logoURI || chainData.currency.img || '',
        imgSrc: isReqSrc(imgSrc) ? imgSrc : undefined,
        selected: false,
        disabled: false,
        isToken: true,
        chain: tokenData.chain.toLowerCase(),
      };

      if (chainData) {
        if (!chainData.tokens) {
          chainData.tokens = [];
        }

        chainData.tokens.push(token);

        if (
          POPULAR_TOKENS[tokenData.chain.toLowerCase()].includes(
            token.currencyAbbreviation.toLowerCase(),
          )
        ) {
          chainData.popularTokens.push(token);
        }
      } else {
        // Parent chain currency not found, just push to the main list.
        list.push({
          currency: token,
          tokens: [],
          popularTokens: [],
        });
      }
    });

    setAllListItems(list);
  }, [
    t,
    appTokenOptions,
    appTokenData,
    appCustomTokenOptions,
    appCustomTokenData,
    context,
  ]);

  const showErrorModal = (e: string) => {
    dispatch(
      showBottomNotificationModal({
        type: 'warning',
        title: t('Something went wrong'),
        message: e,
        enableBackdropDismiss: true,
        actions: [
          {
            text: t('OK'),
            action: () => {},
            primary: true,
          },
        ],
      }),
    );
  };

  const selectedCurrencies = useMemo(() => {
    return allListItems.reduce<
      Array<{chain: string; currencyAbbreviation: string; isToken: boolean}>
    >((accum, item) => {
      if (item.currency.selected) {
        accum.push({
          chain: item.currency.currencyAbbreviation.toLowerCase(),
          currencyAbbreviation:
            item.currency.currencyAbbreviation.toLowerCase(),
          isToken: false,
        });
      }

      item.tokens.forEach(token => {
        if (token.selected) {
          accum.push({
            chain: item.currency.currencyAbbreviation.toLowerCase(),
            currencyAbbreviation: token.currencyAbbreviation.toLowerCase(),
            isToken: true,
          });
        }
      });
      return accum;
    }, []);
  }, [allListItems]);

  const contextHandler = (): ContextHandler | undefined => {
    switch (context) {
      case 'onboarding':
      case 'createNewKey': {
        return {
          selectionMode: 'multi',
          ctaTitle: t('Create Key'),
          onCtaPress: async () => {
            try {
              await dispatch(
                startOnGoingProcessModal(
                  t(OnGoingProcessMessages.CREATING_KEY),
                ),
              );
              const createdKey = await dispatch(
                startCreateKey(selectedCurrencies),
              );

              dispatch(setHomeCarouselConfig({id: createdKey.id, show: true}));

              navigation.navigate(
                context === 'onboarding' ? 'Onboarding' : 'Wallet',
                {
                  screen: 'BackupKey',
                  params: {context, key: createdKey},
                },
              );
              dispatch(
                logSegmentEvent('track', 'Created Key', {
                  context,
                  coins: selectedCurrencies,
                }),
              );
              dispatch(dismissOnGoingProcessModal());
            } catch (e: any) {
              logger.error(e.message);
              dispatch(dismissOnGoingProcessModal());
              await sleep(500);
              showErrorModal(e.message);
            }
          },
        };
      }

      case 'addWallet': {
        return {
          selectionMode: 'single',
          headerTitle: t('Select Currency'),
          ctaTitle: t('Add Wallet'),
          onCtaPress: async () => {
            if (!key) {
              // TODO
              console.error('add wallet - key not found');
              return;
            }

            if (!selectedCurrencies.length) {
              showErrorModal(t('Select a currency'));
              return;
            }

            const selectedId = getCurrencyAbbreviation(
              selectedCurrencies[0].currencyAbbreviation,
              selectedCurrencies[0].chain,
            );
            const item = allListItems.find(
              i =>
                i.currency.currencyAbbreviation.toLowerCase() === selectedId ||
                i.tokens.some(
                  token =>
                    getCurrencyAbbreviation(
                      token.currencyAbbreviation,
                      token.chain,
                    ) === selectedId,
                ),
            );
            let currency: CurrencySelectionItem | undefined;

            if (!item) {
              showErrorModal(t('Select a currency'));
              return;
            }

            if (
              item.currency.currencyAbbreviation.toLowerCase() === selectedId
            ) {
              currency = item.currency;
            } else {
              currency = item.tokens.find(
                token =>
                  getCurrencyAbbreviation(
                    token.currencyAbbreviation,
                    token.chain,
                  ) === selectedId,
              );
            }

            if (!currency) {
              showErrorModal(t('Select a currency'));
              return;
            }

            navigation.navigate('Wallet', {
              screen: 'AddWallet',
              params: {
                key,
                currencyAbbreviation:
                  currency.currencyAbbreviation.toLowerCase(),
                currencyName: currency.currencyName,
                isToken: !!currency.isToken,
                chain: currency.chain,
              },
            });
          },
        };
      }
      case 'addWalletMultisig': {
        return {
          selectionMode: 'single',
          headerTitle: t('Select Currency'),
          ctaTitle: t('Create Wallet'),
          onCtaPress: async () => {
            if (!selectedCurrencies.length) {
              showErrorModal(t('Select a currency'));
              return;
            }

            navigation.navigate('Wallet', {
              screen: 'CreateMultisig',
              params: {
                currency: selectedCurrencies[0].currencyAbbreviation,
                key,
              },
            });
          },
        };
      }
    }
  };

  const {onCtaPress, ctaTitle, headerTitle, selectionMode} =
    contextHandler() || {};

  // Configuring Header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitle>{headerTitle || t('Select Currencies')}</HeaderTitle>
      ),
      headerTitleAlign: 'center',
      headerRight: () =>
        context === 'onboarding' && (
          <HeaderRightContainer>
            <Button
              buttonType={'pill'}
              onPress={() => {
                haptic('impactLight');
                navigation.navigate('Onboarding', {
                  screen: 'TermsOfUse',
                  params: {
                    context: 'TOUOnly',
                  },
                });
              }}>
              {t('Skip')}
            </Button>
          </HeaderRightContainer>
        ),
    });
  }, [navigation, t, context, headerTitle]);

  const onToggle = (currencyAbbreviation: string, chain?: string) => {
    setAllListItems(previous =>
      previous.map(item => {
        const isCurrencyMatch =
          item.currency.currencyAbbreviation === currencyAbbreviation &&
          item.currency.chain === chain;
        const tokenMatch = item.tokens.find(
          token =>
            token.currencyAbbreviation === currencyAbbreviation &&
            item.currency.chain === chain,
        );

        // if multi, just toggle the selected item and rerender
        if (selectionMode === 'multi') {
          if (isCurrencyMatch) {
            const hasSelectedTokens = item.tokens.some(token => token.selected);

            if (item.currency.selected && hasSelectedTokens) {
              // do nothing
            } else {
              item.currency = {
                ...item.currency,
                selected: !item.currency.selected,
              };
            }
          }

          if (tokenMatch) {
            // if selecting a token, make sure its chain is also selected
            if (!item.currency.selected) {
              item.currency = {
                ...item.currency,
                selected: true,
              };
            }

            const updatedToken = {
              ...tokenMatch,
              selected: !tokenMatch.selected,
            };

            // update token state
            item.tokens = item.tokens.map(token => {
              return token.currencyAbbreviation === currencyAbbreviation
                ? updatedToken
                : token;
            });

            // update popular token state
            // append tokens once selected so user can see their entire selection
            let appendToPopular = true;
            item.popularTokens = item.popularTokens.map(token => {
              if (token.currencyAbbreviation === currencyAbbreviation) {
                appendToPopular = false;
              }

              return token.currencyAbbreviation === currencyAbbreviation
                ? updatedToken
                : token;
            });

            if (appendToPopular) {
              item.popularTokens.push(updatedToken);
            }
          }
        }

        // if single, toggle the selected item, deselect any selected items, and rerender
        if (selectionMode === 'single') {
          if (isCurrencyMatch) {
            // if single selection mode, don't toggle if already selected
            if (item.currency.selected) {
              return item;
            }

            item.currency = {
              ...item.currency,
              selected: !item.currency.selected,
            };

            // deselect any selected tokens
            if (item.tokens.some(token => token.selected)) {
              item.tokens = item.tokens.map(token => {
                return token.selected ? {...token, selected: false} : token;
              });
            }

            // deselect any selected popular tokens
            if (item.popularTokens.some(token => token.selected)) {
              item.popularTokens = item.popularTokens.map(token => {
                return token.selected ? {...token, selected: false} : token;
              });
            }
          } else {
            // deselect this item's currency
            if (item.currency.selected) {
              item.currency = {
                ...item.currency,
                selected: false,
              };
            }
          }

          if (tokenMatch) {
            // if single selection mode, don't toggle if already selected
            if (tokenMatch.selected) {
              return item;
            }

            const updatedToken = {
              ...tokenMatch,
              selected: !tokenMatch.selected,
            };

            // update token state
            item.tokens = item.tokens.map(token => {
              if (token.currencyAbbreviation === currencyAbbreviation) {
                return updatedToken;
              }

              return token.selected ? {...token, selected: false} : token;
            });

            // update popular token state
            // append tokens once selected so user can see their entire selection
            let appendToPopular = true;
            item.popularTokens = item.popularTokens.map(token => {
              if (token.currencyAbbreviation === currencyAbbreviation) {
                appendToPopular = false;
                return updatedToken;
              }

              return token.selected ? {...token, selected: false} : token;
            });

            if (appendToPopular) {
              item.popularTokens.push(updatedToken);
            }
          }

          // if selecting a token, make sure deselect any other token selected
          if (
            !tokenMatch &&
            !isCurrencyMatch &&
            item.currency.chain !== chain &&
            item.tokens.length > 0
          ) {
            item.popularTokens = item.popularTokens.map(token => {
              return token.selected ? {...token, selected: false} : token;
            });
            item.tokens = item.tokens.map(token => {
              return token.selected ? {...token, selected: false} : token;
            });
          }
        }

        return item;
      }),
    );
  };

  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  const memoizedOnToggle = useCallback(
    (currencyAbbreviation: string, chain?: string) => {
      onToggleRef.current(currencyAbbreviation, chain);
    },
    [],
  );

  const memoizedOnViewAllPressed = useMemo(() => {
    return (currency: CurrencySelectionItem) => {
      const item = allListItemsRef.current.find(
        i => i.currency.currencyAbbreviation === currency.currencyAbbreviation,
      );

      if (!item) {
        return;
      }

      // sorted selected tokens to the top for ease of use
      const sortedTokens = orderBy(
        item.tokens.map(token => ({...token})),
        'selected',
        'desc',
      );

      navigation.navigate('Wallet', {
        screen: WalletScreens.CURRENCY_TOKEN_SELECTION,
        params: {
          key,
          currency: {...currency},
          tokens: sortedTokens,
          description: item.description,
          selectionMode,
          onToggle: memoizedOnToggle,
        },
      });
    };
  }, [memoizedOnToggle, navigation, key, selectionMode]);

  const renderItem: ListRenderItem<CurrencySelectionListItem> = useCallback(
    ({item}) => {
      return (
        <CurrencySelectionRow
          key={item.currency.id}
          currency={item.currency}
          tokens={item.popularTokens}
          description={item.description}
          selectionMode={selectionMode}
          onToggle={memoizedOnToggle}
          onViewAllTokensPressed={memoizedOnViewAllPressed}
        />
      );
    },
    [memoizedOnToggle, memoizedOnViewAllPressed, selectionMode],
  );

  return (
    <CurrencySelectionContainer>
      <SearchContainer>
        <CurrencySelectionSearchInput
          onSearch={setSearchFilter}
          debounceWait={300}
        />
      </SearchContainer>

      {filteredListItems.length ? (
        <ListContainer>
          <FlatList<CurrencySelectionListItem>
            data={filteredListItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
          />
        </ListContainer>
      ) : (
        <CurrencySelectionNoResults query={searchFilter} walletKey={key} />
      )}

      {onCtaPress && (
        <CtaContainer
          style={{
            shadowColor: '#000',
            shadowOffset: {width: 0, height: 4},
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 5,
            marginTop: 16,
          }}>
          <Button
            onPress={onCtaPress}
            buttonStyle={'primary'}
            disabled={!selectedCurrencies.length}>
            {ctaTitle || t('Continue')}
          </Button>
        </CtaContainer>
      )}
    </CurrencySelectionContainer>
  );
};

export default CurrencySelection;
