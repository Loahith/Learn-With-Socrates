import { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AuthShell from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import api, { errMsg } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";

const password = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a number");

function Submit({ busy, children }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={busy}>
      {busy ? <Spinner className="text-white" /> : children}
    </Button>
  );
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuth((s) => s.setAuth);
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Enter your password") })),
  });

  const onSubmit = async (values) => {
    setServerError("");
    try {
      const { data } = await api.post("/auth/login", values);
      setAuth(data.token, data.user);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (e) {
      setServerError(errMsg(e, "Login failed."));
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue learning."
      footer={<>New here? <Link to="/register" className="font-semibold text-brand">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register("password")} />
        </Field>
        <div className="text-right text-sm"><Link to="/forgot-password" className="font-semibold text-brand">Forgot password?</Link></div>
        {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{serverError}</p>}
        <Submit busy={isSubmitting}>Log in</Submit>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const [serverError, setServerError] = useState("");
  const schema = z
    .object({ name: z.string().min(2, "Enter your name"), email: z.string().email("Enter a valid email"), password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ name, email, password }) => {
    setServerError("");
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      setAuth(data.token, data.user);
      toast.success("Welcome to Learn with Socrates!");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setServerError(errMsg(e, "Registration failed."));
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start learning from your own study materials."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand">Log in</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.name?.message}><Input autoComplete="name" {...register("name")} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message} hint="8+ characters with letters and numbers">
          <Input type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register("confirm")} />
        </Field>
        {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{serverError}</p>}
        <Submit busy={isSubmitting}>Create account</Submit>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [done, setDone] = useState(null);
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(z.object({ email: z.string().email("Enter a valid email") })),
  });

  const onSubmit = async (v) => {
    setServerError("");
    try {
      const { data } = await api.post("/auth/forgot-password", v);
      setDone(data);
    } catch (e) {
      setServerError(errMsg(e));
    }
  };

  return (
    <AuthShell title="Forgot password?" subtitle="Enter your email and we'll create a reset link." footer={<Link to="/login" className="font-semibold text-brand">Back to log in</Link>}>
      {done ? (
        <div className="space-y-3 rounded-2xl bg-brand/10 p-4 text-sm">
          <p className="font-semibold text-forest">{done.message}</p>
          {done.dev_reset_link ? (
            <p className="text-grey">
              Local development has no email server, so use this link:
              <br />
              <a className="break-all font-semibold text-brand underline" href={done.dev_reset_link}>{done.dev_reset_link}</a>
            </p>
          ) : (
            <p className="text-grey">Check your email for the link.</p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
          {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{serverError}</p>}
          <Submit busy={isSubmitting}>Send reset link</Submit>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const schema = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }) => {
    setServerError("");
    try {
      await api.post("/auth/reset-password", { token: params.get("token"), password });
      toast.success("Password updated. Please log in.");
      navigate("/login");
    } catch (e) {
      setServerError(errMsg(e));
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password." footer={<Link to="/login" className="font-semibold text-brand">Back to log in</Link>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="New password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...register("confirm")} /></Field>
        {serverError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{serverError}</p>}
        <Submit busy={isSubmitting}>Update password</Submit>
      </form>
    </AuthShell>
  );
}
