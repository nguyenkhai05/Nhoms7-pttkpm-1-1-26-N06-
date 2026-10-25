import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Pitch, Selection } from "../features/pitches/types";
import type { Page } from "./routes";

export interface AppState {
  page: Page;
  navigate: (page: Page, id?: number) => void;
  pitches: Pitch[];
  search: (filters?: Record<string, string>) => void;
  loading: boolean;
  error: string;
  pitchId: number;
  setPitchId: Dispatch<SetStateAction<number>>;
  selection: Selection | null;
  setSelection: Dispatch<SetStateAction<Selection | null>>;
  select: (selection: Selection) => void;
  selectedPitch: Pitch;
  date: string;
  setDate: Dispatch<SetStateAction<string>>;
  services: string[];
  serviceTotal: number;
  toggleService: (name: string) => void;
  notice: string;
  setNotice: Dispatch<SetStateAction<string>>;
}
export const AppContext = createContext<AppState | null>(null);
export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppContext chưa được cấu hình");
  return context;
}
