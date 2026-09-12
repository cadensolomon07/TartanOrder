"use client";
import { Children, createContext, useContext, type ReactNode } from "react";
import { translate, type Language } from "@/contracts/languages";
export const LanguageContext = createContext<Language>("en-US");
export const useLanguage = () => useContext(LanguageContext);
/** Translate presentation text only; canonical data/actions never change. */
export function T({ children }: { children?: ReactNode }) {
  const language = useLanguage();
  return Children.map(children, child => typeof child === "string" ? translate(child, language) : child);
}
