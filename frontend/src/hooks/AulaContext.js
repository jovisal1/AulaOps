import { createContext, useContext } from "react";
export const AulaContext = createContext(null);
export function useAulaContext() {
  return useContext(AulaContext);
}
