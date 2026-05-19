import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@/config/navigation";
import { useLoginForm } from "./composables/use-login-form";
import { AuthImagePanel } from "./components/auth-image-panel";
import { LoginForm } from "./components/login-form";
import { getRandomQuote } from "@/config/quotes";

export function LoginPage() {
  const form = useLoginForm();

  const quote = getRandomQuote();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <Link
          to={"/" as never}
          className="mb-8 flex items-center gap-2 text-sm font-semibold lg:hidden"
        >
          <BrandIcon className="size-4" />
          BizNest
        </Link>

        <LoginForm
          email={form.email}
          setEmail={form.setEmail}
          password={form.password}
          setPassword={form.setPassword}
          error={form.error}
          loading={form.loading}
          onSubmit={form.handleSubmit}
        />
      </div>

      <AuthImagePanel quote={quote} />
    </div>
  );
}
