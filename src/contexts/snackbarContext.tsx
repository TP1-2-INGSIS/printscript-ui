import { createContext, useContext } from 'react';
import { AlertColor } from '@mui/material';

export type SnackBarType = {
  severity: AlertColor;
  text: string;
};

export type SnackbarContextType = {
  active: SnackBarType[];
  createSnackbar: (severity: AlertColor, text: string) => void;
};

export const SnackbarContext = createContext<SnackbarContextType | null>(null);

export const useSnackbarContext = (): SnackbarContextType => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbarContext must be used within a SnackbarProvider');
  }
  return context;
};
