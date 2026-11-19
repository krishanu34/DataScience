import { createContext, useContext } from "react";
import type { Example, Status } from "../types";

export interface AppData {
  status: Status;
  examples: Record<string, Example[]>;
}

export const AppContext = createContext<AppData>({ status: { live: false, missing: [], roles: [] }, examples: {} });
export const useApp = () => useContext(AppContext);
