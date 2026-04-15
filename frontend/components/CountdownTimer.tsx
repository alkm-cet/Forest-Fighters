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

  // Reset secondsLeft whenever endsAt changes (e.g. after a coin-skip updates the cache)
  useEffect(() => {
    setSecondsLeft(Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000)));
  }, [endsAt]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(id);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  // Fire onExpire after render, never inside a state updater
  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpireRef.current?.();
    }
  }, [secondsLeft]);

  let display: string;
  if (secondsLeft >= 86400) {
    const days = Math.floor(secondsLeft / 86400);
    const hours = Math.floor((secondsLeft % 86400) / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    display = `${days}g ${hours}s ${String(minutes).padStart(2, "0")}d ${String(seconds).padStart(2, "0")}sn`;
  } else if (secondsLeft >= 3600) {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    display = `${hours}s ${String(minutes).padStart(2, "0")}d ${String(seconds).padStart(2, "0")}sn`;
  } else {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

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
