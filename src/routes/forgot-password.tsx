import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/ui/card";
import { TextField, TextFieldRoot, TextFieldLabel } from "@/ui/textfield";

import { Mail } from "lucide-solid";
import { createSignal } from "solid-js";
import { A } from "@solidjs/router";

export default function ForgotPasswordPage() {
  const [email, setEmail] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    console.log("Password reset request for:", email());
    // Add your logic to send a reset email
  };

  return (
    <div class="flex min-h-[calc(100vh-theme(spacing.14))] items-center justify-center p-4">
      <Card class="w-full max-w-md loci-card">
        <form onSubmit={handleSubmit}>
          <CardHeader class="text-center">
            <CardTitle>Forgot Your Password?</CardTitle>
            <CardDescription>
              No problem. Enter your email and we'll send you a link to reset it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TextFieldRoot class="space-y-2">
              <TextFieldLabel for="email">Email</TextFieldLabel>
              <div class="relative">
                <Mail class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <TextField
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  class="pl-10"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                />
              </div>
            </TextFieldRoot>
          </CardContent>
          <CardFooter class="flex flex-col gap-4">
            <Button type="submit" class="w-full" size="lg">
              Send Reset Link
            </Button>
            <A href="/auth" class="text-sm text-primary hover:underline">
              Back to Sign In
            </A>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
