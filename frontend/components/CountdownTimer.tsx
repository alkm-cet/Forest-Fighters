import { useEffect, useRef, useState } from "react";
import { Text } from "./StyledText";
import { StyleSheet } from "react-native";

type Props = {
  endsAt: string;
  onExpire?: () => void;
  style?: object;
};

export default function CountdownTimer({ endsAt, onExpire, style }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
  );
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpireRef.current?.();
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(id);
          onExpireRef.current?.();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return <Text style={[styles.timer, style]}>{display}</Text>;
}

const styles = StyleSheet.create({
  timer: {
    fontSize: 18,
    fontWeight: "800",
    color: "#4a7c3f",
    letterSpacing: 1.5,
  },
});
