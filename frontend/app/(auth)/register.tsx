import { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text, TextInput } from "../../components/StyledText";
import { useRouter } from "expo-router";
import api from "../../lib/api";
import { saveToken } from "../../lib/auth";
import { useLanguage } from "../../lib/i18n";

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleRegister() {
    setError("");
    try {
      await api.post("/api/auth/register", { username, email, password });
      const loginRes = await api.post("/api/auth/login", { email, password });
      await saveToken(loginRes.data.token);
      router.replace("/(game)/");
    } catch (err: any) {
      const msg = err.response?.data?.error || t("registerFailed");
      setError(msg);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("createAccount")}</Text>
      <TextInput
        style={styles.input}
        placeholder={t("username")}
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder={t("email")}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={t("password")}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>{t("register")}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>{t("haveAccount")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f0f8f0",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 32,
    color: "#2d6a2d",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  button: {
    backgroundColor: "#3a8c3a",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  link: { textAlign: "center", marginTop: 16, color: "#3a8c3a" },
  error: { color: "red", textAlign: "center", marginBottom: 8 },
});
