import React, {useRef, useState} from 'react';
import {StatusBar} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import styled from 'styled-components/native';

import Carousel, {Pagination} from 'react-native-snap-carousel';
import OnboardingSlide from '../components/OnboardingSlide';

import CryptoToCash from '../../../../assets/img/onboarding/crypto-to-cash.svg';
import GiftCards from '../../../../assets/img/onboarding/gift-cards.svg';
import WalletAndCoins from '../../../../assets/img/onboarding/wallet-and-coins.svg';
import SwapCrypto from '../../../../assets/img/onboarding/swap-crypto.svg';

import Button from '../../../components/button/Button';
import haptic from '../../../components/haptic-feedback/haptic';
import {Action} from '../../../styles/colors';
import {
  CtaContainerAbsolute,
  WIDTH,
} from '../../../components/styled/Containers';

const onboardingSlides = [
  {
    title: 'Turn crypto into dollars with our BitPay card',
    text: 'Instantly reload your card balance with no conversion fees. Powered by our competitive exchange rates.',
    subText: '*Currently available in the USA. More countries coming soon.',
    img: () => <CryptoToCash />,
  },
  {
    title: 'Spend crypto at your favorite places',
    text: 'Discover a curated list of places you can spend your crypto. Purchase, manage, & spend store credits instantly.',
    img: () => <GiftCards />,
  },
  {
    title: 'Keep your funds safe & secure',
    text: 'Websites and exchanges get hacked. BitPay allows you to privately store, manage, and use your crypto funds without having to trust a centralized bank or exchange.',
    img: () => <WalletAndCoins />,
  },
  {
    title: 'Seamlessly buy & swap with a decentralized exchange',
    text: ' Buy with a credit card or existing funds, then seamlessly swap coins at competitive rates without leaving the app.',
    img: () => <SwapCrypto />,
  },
];

const OnboardingContainer = styled.SafeAreaView`
  flex: 1;
  position: relative;
`;

const Row = styled.View`
  flex-direction: row;
  justify-content: center;
`;

const Column = styled.View`
  flex-direction: column;
  justify-content: center;
  margin: 0 5px;
  flex: 1;
`;

const OnboardingStart = () => {
  const navigation = useNavigation();
  const ref = useRef(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const login = () => {
    haptic('impactLight');
    navigation.navigate('Onboarding', {
      screen: 'Login',
      params: {context: 'signup'},
    });
  };

  const continueWithoutAccount = () => {
    haptic('impactLight');
    navigation.navigate('Onboarding', {
      screen: 'Notifications',
    });
  };

  return (
    <OnboardingContainer>
      <StatusBar barStyle="dark-content" />
      <Carousel
        vertical={false}
        layout={'default'}
        useExperimentalSnap={true}
        data={onboardingSlides}
        renderItem={slideProps => <OnboardingSlide {...slideProps} />}
        ref={ref}
        sliderWidth={WIDTH}
        itemWidth={Math.round(WIDTH)}
        onScrollIndexChanged={(index: number) => {
          haptic('impactLight');
          setActiveSlideIndex(index);
        }}
        // @ts-ignore
        disableIntervalMomentum={true}
      />
      <CtaContainerAbsolute>
        <Row>
          <Column>
            <Pagination
              dotsLength={onboardingSlides.length}
              activeDotIndex={activeSlideIndex}
              tappableDots={true}
              carouselRef={ref}
              animatedDuration={100}
              animatedFriction={100}
              animatedTension={100}
              dotStyle={{
                backgroundColor: Action,
                width: 15,
                height: 15,
                borderRadius: 10,
                marginHorizontal: 1,
              }}
              inactiveDotOpacity={0.4}
              inactiveDotScale={0.5}
            />
          </Column>
          <Column>
            <Button buttonStyle={'primary'} onPress={login}>
              Get Started
            </Button>
          </Column>
        </Row>
        <Row>
          <Button buttonType={'link'} onPress={continueWithoutAccount}>
            Continue without an account
          </Button>
        </Row>
      </CtaContainerAbsolute>
    </OnboardingContainer>
  );
};

export default OnboardingStart;