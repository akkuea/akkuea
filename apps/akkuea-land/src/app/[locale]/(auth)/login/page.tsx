import { getTranslations } from "next-intl/server";
import { LoginBody } from "./LoginBody";

export async function generateMetadata() {
  const t = await getTranslations("Login");
  return {
    title: t("pageTitle"),
  };
}

export default function LoginPage() {
  return <LoginBody />;
}
