import { cn } from "../cn";
import type { ComponentProps, ParentComponent } from "solid-js";
import { splitProps } from "solid-js";

/**
 * The one card surface.
 *
 * Previously `glass-panel gradient-border`, which stacked a decorative gradient
 * edge on top of the panel and diverged from `.loci-card` used everywhere else —
 * so the same visual idea had two implementations that drifted. This is the
 * single card layer now; `<Card>` and a bare `.loci-card` render identically.
 */
export const Card = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"]);

  return <div class={cn("loci-card text-card-foreground", local.class)} {...rest} />;
};

export const CardHeader = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"]);

  return <div class={cn("flex flex-col space-y-1.5 p-6", local.class)} {...rest} />;
};

export const CardTitle: ParentComponent<ComponentProps<"h1">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);

  return <h1 class={cn("font-semibold leading-none tracking-tight", local.class)} {...rest} />;
};

export const CardDescription: ParentComponent<ComponentProps<"h3">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);

  return <h3 class={cn("text-sm text-muted-foreground", local.class)} {...rest} />;
};

export const CardContent = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"]);

  return <div class={cn("p-6 pt-0", local.class)} {...rest} />;
};

export const CardFooter = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"]);

  return <div class={cn("flex items-center p-6 pt-0", local.class)} {...rest} />;
};
