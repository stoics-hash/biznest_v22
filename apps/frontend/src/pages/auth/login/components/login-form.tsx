import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Link } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/pages/auth/components/password-input";

interface LoginFormProps {
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  error: string | null;
  loading: boolean;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading,
  onSubmit,
}: LoginFormProps) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your credentials to access your account.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="juandelacruz@gmail.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <PasswordInput
          id="password"
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading && <Spinner className="mr-2 size-4" />}
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          to="/register"
          className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
