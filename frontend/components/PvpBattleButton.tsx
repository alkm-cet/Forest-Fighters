import { ViewStyle } from "react-native";
import CustomButton from "./CustomButton";
import { useLanguage } from "../lib/i18n";

const crossSwords = require("../assets/cross-swords.png");

type Props = {
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
};

export default function PvpBattleButton({ onPress, style, disabled }: Props) {
  const { t } = useLanguage();
  return (
    <CustomButton
      btnImage={crossSwords}
      btnImagePos="left"
      text={`${t("pvp")} ${t("battle")}`}
      onClick={onPress}
      bgColor="#6B8D9F"
      borderColor="#4a5f72"
      style={style}
      disabled={disabled}
    />
  );
}
