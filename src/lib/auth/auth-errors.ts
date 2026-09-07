import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Turns whatever an auth RPC threw into something a form can show a person.
 *
 * The rule this file exists to enforce: **a server message is never rendered.**
 * The live sign-in page used to print `err.message` straight into the page, so
 * a misconfigured OAuth provider showed up as
 * `[failed_precondition] OAuth provider not configured` — a Connect code, an
 * internal noun, and a hint about our deployment, all in the one place a
 * stranger meets the product.
 *
 * It maps on `ConnectError.code` rather than on the message text. The forms
 * previously matched prose — `message.toLowerCase().includes("invalid
 * credentials")` and eight more like it, duplicated across four files — which
 * breaks silently the day the server rewords anything, and reverts to printing
 * the raw message when it does.
 */

/** Which form asked. The same code means different things per form. */
export type AuthAction =
  | "sign-in"
  | "sign-up"
  | "mfa"
  | "reset-request"
  | "reset-password"
  | "google"
  | "apple";

/**
 * The input to mark, or null for a form-level message that marks nothing.
 *
 * Wider than what `describeAuthError` can return: "username" and
 * "confirmPassword" only ever come from a form's own validation, which knows
 * exactly which box is wrong. One type for "which box is marked" beats two.
 */
export type AuthErrorField = "email" | "password" | "confirmPassword" | "username" | "code" | null;

export interface AuthErrorView {
  /** Safe to render. Never contains a server string or a Connect code. */
  message: string;
  field: AuthErrorField;
}

const GENERIC = "Something went wrong on our side. Please try again in a moment.";
const OFFLINE = "Could not reach Loci. Check your connection and try again.";
const SLOW = "That took too long. Please try again.";
const THROTTLED = "Too many attempts. Please wait a few minutes and try again.";

// Deliberately identical for a wrong password and an email with no account.
// Distinguishing them turns the sign-in form into an account-enumeration oracle:
// anyone could learn whether a given address has a Loci account by watching
// which sentence comes back. The server still answers NotFound, so the
// indistinguishability has to happen here.
const BAD_CREDENTIALS = "That email and password don't match an account.";

const PROVIDER_LABEL: Record<string, string> = { google: "Google", apple: "Apple" };

function socialUnavailable(action: AuthAction): AuthErrorView {
  return {
    message: `${PROVIDER_LABEL[action] ?? "That"} sign-in isn't available right now. Try your email and password instead.`,
    field: null,
  };
}

/**
 * A fetch that never reached the server.
 *
 * Connect wraps a rejected fetch as a `ConnectError` with `Code.Unknown` and the
 * original `TypeError` as its `cause`, so this checks the cause's type rather
 * than the message. That matters: "Failed to fetch" is the *browser's* wording
 * and differs across engines, and matching it was one of the prose checks this
 * module replaces.
 */
function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof ConnectError && error.cause instanceof TypeError;
}

/**
 * Did this fail without the server ever answering?
 *
 * The forgot-password form deliberately claims success whatever the server
 * says, so that it cannot be used to test whether an address has an account.
 * That is right for an answer, and wrong for silence: if the request never
 * landed, telling someone a reset email is on its way leaves them waiting for
 * one that was never sent. This is the line between the two.
 */
export function neverReachedServer(error: unknown): boolean {
  if (isNetworkFailure(error)) return true;
  if (!(error instanceof ConnectError)) return false;
  return (
    error.code === Code.Unavailable ||
    error.code === Code.DeadlineExceeded ||
    error.code === Code.Canceled
  );
}

/**
 * Map a thrown auth error to a message and, where it is genuinely a field's
 * fault, the field to mark.
 *
 * `field` is null for most cases on purpose. An OAuth outage is not the email
 * box's fault, and reddening both inputs for it — which is what the single
 * `hasAuthError` flag used to do — tells the user to go and edit two values
 * that were correct.
 */
export function describeAuthError(error: unknown, action: AuthAction): AuthErrorView {
  if (isNetworkFailure(error)) {
    return { message: OFFLINE, field: null };
  }

  if (!(error instanceof ConnectError)) {
    // Not from an RPC at all — a bug in our own code, most likely. The user
    // gets the generic line; the detail goes where a developer will see it.
    console.error(`auth error (${action}), not a ConnectError:`, error);
    return { message: GENERIC, field: null };
  }

  switch (error.code) {
    case Code.Unauthenticated:
      if (action === "mfa") {
        // A challenge token that has expired fails exactly like a wrong code,
        // so the message has to cover both or people retype a correct code
        // until they give up.
        return {
          message: "That code wasn't accepted. If it has been a few minutes, sign in again.",
          field: "code",
        };
      }
      if (action === "reset-password") {
        return {
          message: "This reset link has expired. Request a new one and try again.",
          field: null,
        };
      }
      return { message: BAD_CREDENTIALS, field: null };

    case Code.NotFound:
      if (action === "sign-in") return { message: BAD_CREDENTIALS, field: null };
      if (action === "reset-request") {
        // Same reasoning as BAD_CREDENTIALS, and the form claims to have sent
        // an email either way, so there is nothing to reveal here.
        return { message: GENERIC, field: null };
      }
      return { message: GENERIC, field: null };

    case Code.AlreadyExists:
      return {
        message: "An account with that email already exists. Try signing in instead.",
        field: "email",
      };

    case Code.InvalidArgument:
      // The server validated a field, but the code alone does not say which, and
      // its message is not ours to show. Client-side validation is what should
      // catch these before they leave the browser.
      return { message: "Please check the details above and try again.", field: null };

    case Code.PermissionDenied:
      return {
        message: "This account has been deactivated. Contact support if that's unexpected.",
        field: null,
      };

    case Code.FailedPrecondition:
      if (action === "google" || action === "apple") return socialUnavailable(action);
      return { message: GENERIC, field: null };

    case Code.Unimplemented:
      if (action === "google" || action === "apple") return socialUnavailable(action);
      return { message: GENERIC, field: null };

    case Code.ResourceExhausted:
      return { message: THROTTLED, field: null };

    case Code.Unavailable:
      return { message: OFFLINE, field: null };

    case Code.DeadlineExceeded:
      return { message: SLOW, field: null };

    case Code.Canceled:
      // The user navigated away or hit the button twice. Saying anything here is
      // noise about something they already know they did.
      return { message: "", field: null };

    default:
      console.error(`auth error (${action}), unmapped code ${error.code}:`, error.rawMessage);
      return { message: GENERIC, field: null };
  }
}
