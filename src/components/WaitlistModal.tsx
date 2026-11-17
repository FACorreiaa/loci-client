import { createSignal, Show } from "solid-js";
import { X, Mail, Smartphone, CheckCircle } from "lucide-solid";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";

interface WaitlistModalProps {
  isOpen: () => boolean;
  onClose: () => void;
}

export default function WaitlistModal(props: WaitlistModalProps) {
  const [email, setEmail] = createSignal("");
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isSubmitted, setIsSubmitted] = createSignal(false);
  const [emailError, setEmailError] = createSignal("");

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!validateEmail(email())) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call - replace with actual waitlist API
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setEmail("");
        setEmailError("");
        props.onClose();
      }, 2000);
    } catch (error) {
      console.error("Failed to join waitlist:", error);
      setEmailError("Failed to join waitlist. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <Card class="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
          <CardHeader class="relative pb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={props.onClose}
              class="absolute right-4 top-4"
              aria-label="Close modal"
            >
              <X class="w-4 h-4" />
            </Button>

            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg">
                <Smartphone class="w-5 h-5 text-primary-foreground" />
              </div>
              <CardTitle class="text-xl font-bold">Join the Waitlist</CardTitle>
            </div>

            <p class="text-muted-foreground text-sm">
              Be the first to know when our mobile apps launch. We'll send you an exclusive early
              access invitation.
            </p>
          </CardHeader>

          <CardContent class="pt-0">
            <Show
              when={!isSubmitted()}
              fallback={
                <div class="text-center py-6">
                  <div class="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle class="w-8 h-8 text-accent-foreground" />
                  </div>
                  <h3 class="text-lg font-semibold text-foreground mb-2">You're on the list!</h3>
                  <p class="text-muted-foreground text-sm">
                    Thanks for joining! We'll notify you as soon as the apps are ready.
                  </p>
                </div>
              }
            >
              <form onSubmit={handleSubmit} class="space-y-4">
                <TextFieldRoot validationState={emailError() ? "invalid" : "valid"}>
                  <Label for="waitlist-email" class="block mb-2">
                    Email Address
                  </Label>
                  <div class="relative">
                    <Mail
                      class={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${emailError() ? "text-destructive" : "text-muted-foreground"}`}
                    />
                    <TextField
                      id="waitlist-email"
                      type="email"
                      value={email()}
                      onInput={(e) => {
                        setEmail(e.currentTarget.value);
                        if (emailError()) setEmailError("");
                      }}
                      placeholder="your@email.com"
                      class={`pl-10 ${emailError() ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  <Show when={emailError()}>
                    <p class="text-sm text-destructive mt-1">{emailError()}</p>
                  </Show>
                </TextFieldRoot>

                <div class="space-y-3">
                  <Button type="submit" disabled={isSubmitting()} class="w-full">
                    {isSubmitting() ? (
                      <div class="flex items-center justify-center gap-2">
                        <div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Joining...
                      </div>
                    ) : (
                      "Join Waitlist"
                    )}
                  </Button>

                  <div class="text-center">
                    <p class="text-xs text-muted-foreground">
                      We respect your privacy. No spam, just updates about our mobile apps.
                    </p>
                  </div>
                </div>
              </form>
            </Show>
          </CardContent>
        </Card>
      </div>
    </Show>
  );
}
