import React from 'react';
import { Text } from 'react-native';
import tw from 'twrnc';

const fontMap = {
  regular: 'Poppins-Regular',
  bold: 'Poppins-Bold',
  semibold: 'Poppins-SemiBold',
  medium: 'Poppins-Medium',
  light: 'Poppins-Light',
  thin: 'Poppins-Thin',
  extrabold: 'Poppins-ExtraBold',
  extralight: 'Poppins-ExtraLight',
};

const CustomText = ({ style, weight = 'regular', children, ...props }) => {
  const fontFamily = fontMap[weight.toLowerCase()] || fontMap.regular;

  return (
    <Text style={[tw`text-base`, { fontFamily }, style]} {...props}>
      {children}
    </Text>
  );
};

export default CustomText;
