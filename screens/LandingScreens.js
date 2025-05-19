import React, { useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import CustomText from '../components/CustomText';
import tw from 'twrnc';

const { width } = Dimensions.get('window');

const slides = [
  {
    key: '1',
    title: 'Find Lost Pets Smarter',
    description: 'Use AI-driven search strategies based on real animal behavior to find your pets faster.',
    image: require('../assets/images/slideimg1.png'),
    backgroundColor: '#C4B5FD',
  },
  {
    key: '2',
    title: 'Community-Powered Rescue',
    description: 'Connect with rescuers nearby through real-time notifications and team up to bring pets home.',
    image: require('../assets/images/slideimg2.png'),
    backgroundColor: '#FECACA',
  },
  {
    key: '3',
    title: 'Coordinate in Real-Time',
    description: 'Chat with rescuers, share sightings, and get updates instantly in our rescue coordination chatroom.',
    image: require('../assets/images/slideimg3.png'),
    backgroundColor: '#FDE68A',
  },
];

export default function LandingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();

  const handleSkip = () => {
    if (currentSlide < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: slides.length - 1, animated: true });
    } else {
      navigation.navigate('Login');
    }
  };

  return (
    <View style={tw`flex-1 bg-white`}>
      <View style={tw`absolute top-7 left-2 z-10`}>
        <Image source={require('../assets/images/black_logo.png')} style={[tw`w-20 h-20`, { tintColor: '#444' }]} resizeMode="contain" />
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        decelerationRate="fast"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={e => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentSlide(newIndex);
        }}
        keyExtractor={item => item.key}
        renderItem={({ item, index }) => {
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
          const scale = scrollX.interpolate({ inputRange, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' });
          const rotate = scrollX.interpolate({ inputRange, outputRange: ['-15deg', '0deg', '15deg'], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });

          return (
            <View style={[tw`flex-1 items-center justify-center`, { width }]}>
              <View style={tw`flex-row flex-wrap justify-center`}>
                {slides.map((slide, idx) => {
                  const isCurrent = index === idx;
                  return (
                    <Animated.View
                      key={idx}
                      style={[
                        tw`rounded-full justify-center items-center border-4 border-white m-1`,
                        {
                          backgroundColor: slide.backgroundColor,
                          transform: isCurrent ? [{ scale }, { rotate }] : [],
                          opacity: isCurrent ? opacity : 0.6,
                          zIndex: isCurrent ? 10 : 1,
                          width: isCurrent ? 180 : 140,
                          height: isCurrent ? 180 : 140,
                        },
                      ]}
                    >
                      <View
                        style={[
                          tw`absolute border-2 border-blue-500 border-dashed opacity-70`,
                          {
                            width: isCurrent ? 190 : 150,
                            height: isCurrent ? 190 : 150,
                            borderRadius: isCurrent ? 95 : 75,
                          },
                        ]}
                      />
                      <Image
                        source={slide.image}
                        style={{
                          width: isCurrent ? 160 : 120,
                          height: isCurrent ? 160 : 120,
                          borderRadius: 80,
                        }}
                        resizeMode="cover"
                      />
                    </Animated.View>
                  );
                })}
              </View>

              <CustomText style={tw`text-[22px] text-center text-[#444] pt-10 px-6`} weight="Bold">
                {item.title}
              </CustomText>
              <CustomText style={tw`text-sm text-center text-gray-500 px-6 mb-10`}>
                {item.description}
              </CustomText>
              {index === 0 && (
                <CustomText style={tw`text-xs text-center text-gray-400`}>
                  Swipe right to learn more
                </CustomText>
              )}
            </View>
          );
        }}
      />

      <View style={tw`absolute bottom-10 left-6 right-6 flex-row justify-between items-center`}>
        <View style={tw`flex-row items-center`}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                tw`rounded-full mr-2`,
                {
                  width: i === currentSlide ? 12 : 8,
                  height: i === currentSlide ? 12 : 8,
                  backgroundColor: i === currentSlide ? '#2A80FD' : '#D1D5DB',
                },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity onPress={handleSkip} style={tw`bg-[#2A80FD] rounded-md py-3 px-6 shadow-md`}>
          <CustomText style={tw`text-white text-[14px] text-center`} weight="SemiBold">
            {currentSlide === slides.length - 1 ? 'Get Started' : 'Skip'}
          </CustomText>
        </TouchableOpacity>
      </View>
    </View>
  );
}