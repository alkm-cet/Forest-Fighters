import React, { forwardRef } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  TextProps,
  TextInputProps,
} from "react-native";

const FONT_FAMILY = "Fredoka-Regular";

export const Text = forwardRef<RNText, TextProps>((props, ref) => (
  <RNText
    ref={ref}
    {...props}
    style={[{ fontFamily: FONT_FAMILY }, props.style]}
  />
));

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  (props, ref) => (
    <RNTextInput
      ref={ref}
      {...props}
      style={[{ fontFamily: FONT_FAMILY }, props.style]}
    />
  ),
);
