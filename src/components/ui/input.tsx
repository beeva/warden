import { type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const fieldClassName =
  "w-full rounded-lg border border-steel-700 bg-steel-900 px-3 py-2 text-sm text-steel-100 " +
  "placeholder:text-steel-500 transition-colors focus:border-cobalt-500 focus:outline-none " +
  "focus:ring-1 focus:ring-cobalt-500 disabled:cursor-not-allowed disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={cn(fieldClassName, className)} {...props} />;
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return <textarea ref={ref} className={cn(fieldClassName, "min-h-24 resize-y", className)} {...props} />;
  }
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-steel-300", className)} {...props} />;
}
