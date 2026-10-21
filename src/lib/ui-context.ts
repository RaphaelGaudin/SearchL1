import { createContext, useContext } from 'react';

export const UiCtx = createContext<{ openSearch: () => void }>({ openSearch: () => {} });
export const useUi = () => useContext(UiCtx);
