// components/CustomTextInput.js
import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
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

const CustomTextInput = ({
  placeholder,
  placeholderTextColor = "#9CA3AF",
  placeholderTextSize = 14, // Default placeholder size
  style,
  weight = 'regular',
  ...props
}) => {
  const fontFamily = fontMap[weight.toLowerCase()] || fontMap.regular;

  return (
    <TextInput
      style={[
        tw`bg-gray-50 rounded-xl px-4 py-3.5 text-gray-800 border border-gray-200`,
        { 
          fontFamily,
          fontSize: 16, // Main text size
        },
        style
      ]}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      // For Android
      fontSize={placeholderTextSize}
      // For iOS - we'll use a different approach if needed
      {...props}
    />
  );
};

export default CustomTextInput;