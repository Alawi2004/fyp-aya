import { createContext, useContext } from 'react';

// Lets a focused screen push the global passenger chat FAB up so it clears
// the screen's own bottom action bar (e.g. seat booking's "Book Now" bar).
export const FabOffsetContext = createContext(() => {});

export const useSetFabOffset = () => useContext(FabOffsetContext);
