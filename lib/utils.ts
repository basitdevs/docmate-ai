// lib/utils.ts
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to conditionally merge classNames.
 * - `clsx` handles conditional/class object logic
 * - `tailwind-merge` resolves conflicting Tailwind classes
 */
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}
