import { createContext, useContext } from 'react';

// Recherche et menu « Plus » : ouverts depuis la barre du haut de chaque page.
export const UiCtx = createContext<{ openSearch: () => void; openMore: () => void }>({ openSearch: () => {}, openMore: () => {} });
export const useUi = () => useContext(UiCtx);
