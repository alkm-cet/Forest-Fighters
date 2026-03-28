import { ViewStyle } from "react-native";
import CustomButton from "./CustomButton";
import { useLanguage } from "../lib/i18n";

const dungeonIcon = require("../assets/dungeon.png");

type Props = {
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
};

export default function EnterDungeonButton({ onPress, style, disabled }: Props) {
  const { t } = useLanguage();
  return (
    <CustomButton
      btnImage={dungeonIcon}
      btnImagePos="left"
      text={`${t("enter")} ${t("dungeon")}`}
      onClick={onPress}
      bgColor="#6D7579"
      borderColor="#4a5f72"
      style={style}
      disabled={disabled}
    />
  );
}
