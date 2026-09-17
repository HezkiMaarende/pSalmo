import React, { createContext, useContext, useState } from "react";

const Context = createContext<{ metronomeActive: boolean; setMetronomeActive(value: boolean): void }>(null!);
export const useNavigationChrome = () => useContext(Context);
export function NavigationChromeProvider({ children }: { children: React.ReactNode }) {
  const [metronomeActive, setMetronomeActive] = useState(false);
  return <Context.Provider value={{ metronomeActive, setMetronomeActive }}>{children}</Context.Provider>;
}
