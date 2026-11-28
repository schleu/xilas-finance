import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ButtonProps = React.ComponentProps<typeof Button>;

interface IconTooltipButtonProps extends Omit<ButtonProps, "size" | "children"> {
  label: string;
  icon: React.ReactNode;
}

/**
 * Icon-only action button that shows its label on hover/focus via Tooltip
 * and exposes an accessible aria-label + title.
 */
export function IconTooltipButton({
  label,
  icon,
  variant = "ghost",
  type = "button",
  ...props
}: IconTooltipButtonProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type={type}
            size="icon-sm"
            variant={variant}
            aria-label={label}
            title={label}
            {...props}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
