import { createContext, useContext } from "react";

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

export interface ToastApi {
  show: (t: Omit<ToastItem, "id">) => void;
}

export const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
