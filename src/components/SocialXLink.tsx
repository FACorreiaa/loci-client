export const X_PROFILE_URL = "https://x.com/fatc88";

/** Small dim "X" text link in the nav, beside the sign-in / account controls. */
export default function SocialXLink(props: { class?: string }) {
  return (
    <a
      href={X_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fernando on X"
      class={`rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground ${props.class ?? ""}`}
    >
      X
    </a>
  );
}
