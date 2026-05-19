import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@/config/navigation";
import { useRegisterForm } from "./composables/use-register-form";
import { RegisterForm } from "./components/register-form";
import { AuthImagePanel } from "./components/auth-image-panel";
import { getRandomQuote } from "@/config/quotes";

export function RegisterPage() {
  const form = useRegisterForm();

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

        <RegisterForm
          email={form.email}
          setEmail={form.setEmail}
          fullName={form.fullName}
          setFullName={form.setFullName}
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
