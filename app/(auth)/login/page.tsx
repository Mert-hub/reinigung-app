"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getDefaultRouteForRole, resolveUserRole, signInWithEmailPassword } from "@/src/lib/auth";
import { BrandMark } from "@/src/components/brand/brand-mark";
import { LanguageSwitcher } from "@/src/components/i18n/language-switcher";
import { useI18n } from "@/src/i18n/provider";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { data, error } = await signInWithEmailPassword(email, password);
      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(t("auth.userMissing"));
      }

      const role = await resolveUserRole(data.user);
      router.replace(getDefaultRouteForRole(role));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth.loginFailed");
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <BrandMark variant="login" className="w-full" />
      </div>
      <section className="w-full rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-[#0a0a0a]">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-sm text-[#374151]">{t("auth.loginSubtitle")}</p>

        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#0a0a0a]">{t("auth.email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-[#0a0a0a] outline-none ring-brand/30 focus:ring-2"
              placeholder={t("auth.emailPlaceholder")}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#0a0a0a]">{t("auth.password")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-[#0a0a0a] outline-none ring-brand/30 focus:ring-2"
              placeholder="••••••••"
            />
          </label>

          {errorMessage && (
            <p className="rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-md bg-brand text-sm font-semibold text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
          >
            {isSubmitting ? t("auth.loginSubmitting") : t("auth.loginButton")}
          </button>
        </form>
      </section>
    </main>
  );
}
