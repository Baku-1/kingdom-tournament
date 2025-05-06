'use client';

import { ChakraProvider as ChakraUIProvider, extendTheme } from '@chakra-ui/react';
import { ReactNode } from 'react';

// Create a basic theme for Chakra UI
const theme = extendTheme({
  config: {
    cssVarPrefix: 'kingdom',
  },
});

export function ChakraProvider({ children }: { children: ReactNode }) {
  return <ChakraUIProvider theme={theme}>{children}</ChakraUIProvider>;
}
