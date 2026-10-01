import { Button } from "@/ui/button";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { FiCheck, FiMail } from "solid-icons/fi";
import { Component, createSignal, onMount, Show } from "solid-js";
import AuthLayout from "../../layout/Auth";
import { useConfirmEmailChangeMutation } from "~/lib/api/auth-connect";

/**
 * Opened from the link ChangeEmail mails to the new address: confirms at once
 * and says what happened. The old address keeps working until this runs.
 */
const ConfirmEmailChange: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const confirm = useConfirmEmailChangeMutation();
  const [state, setState] = createSignal<"working" | "done" | "failed">("working");
  const [message, setMessage] = createSignal("");

  const token = (): string => {
    const t = searchParams.token;
    return (Array.isArray(t) ? t[0] : t)?.trim() ?? "";
  };

  onMount(() => {
    if (!token()) {
      setMessage("This link is missing its token. Start the change again from Settings.");
      setState("failed");
      return;
    }
    confirm.mutate(
      { token: token() },
      {
        onSuccess: (r) => {
          if (r.success) setState("done");
          else {
            setMessage(r.message || "This link has expired. Start the change again from Settings.");
            setState("failed");
          }
        },
        onError: (e) => {
          setMessage(
            e instanceof Error
              ? e.message
              : "This link has expired. Start the change again from Settings.",
          );
          setState("failed");
        },
      },
    );
  });

  return (
    <AuthLayout showBackButton onBack={() => navigate("/auth/signin")}>
      <div class="text-center space-y-4">
        <div class="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto border border-primary/20">
          <Show when={state() === "done"} fallback={<FiMail class="w-8 h-8 text-primary" />}>
            <FiCheck class="w-8 h-8 text-primary" />
          </Show>
        </div>
        <Show when={state() === "working"}>
          <h1 class="text-2xl font-bold tracking-tight text-foreground">
            Confirming your new email…
          </h1>
        </Show>
        <Show when={state() === "done"}>
          <h1 class="text-2xl font-bold tracking-tight text-foreground">Email changed</h1>
          <p class="text-muted-foreground">Sign in with the new address from now on.</p>
          <Button class="w-full py-3 font-semibold" onClick={() => navigate("/auth/signin")}>
            Sign in
          </Button>
        </Show>
        <Show when={state() === "failed"}>
          <h1 class="text-2xl font-bold tracking-tight text-foreground">Could not confirm</h1>
          <p class="text-muted-foreground">{message()}</p>
          <Button class="w-full py-3 font-semibold" onClick={() => navigate("/settings")}>
            Back to Settings
          </Button>
        </Show>
      </div>
    </AuthLayout>
  );
};

export default ConfirmEmailChange;
