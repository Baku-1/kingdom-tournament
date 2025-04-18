'use client';

import { ChakraProvider as ChakraUIProvider, createTheme } from '@chakra-ui/react';
import { ReactNode } from 'react';

// Create a basic theme for Chakra UI v3
const theme = createTheme({
  cssVarPrefix: 'kingdom',
});

export function ChakraProvider({ children }: { children: ReactNode }) {
  return <ChakraUIProvider theme={theme}>{children}</ChakraUIProvider>;
}
