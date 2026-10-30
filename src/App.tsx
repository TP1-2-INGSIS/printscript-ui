import './App.css';
import { RouterProvider } from 'react-router';
import { createBrowserRouter } from 'react-router-dom';
import HomeScreen from './screens/Home.tsx';
import { QueryClient, QueryClientProvider } from 'react-query';
import RulesScreen from './screens/Rules.tsx';
import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import React, { useEffect, useRef } from 'react';

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomeScreen />,
  },
  {
    path: '/rules',
    element: <RulesScreen />,
  },
]);

export const queryClient = new QueryClient();

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, isAuthenticated, error, loginWithRedirect } = useAuth0();
  const redirectedRef = useRef(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryError = searchParams.get('error');

    if (error || queryError) {
      return;
    }

    if (!isLoading && !isAuthenticated && !redirectedRef.current) {
      redirectedRef.current = true;
      loginWithRedirect();
    }
  }, [isLoading, isAuthenticated, error, loginWithRedirect]);

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh" width="100vw">
        <CircularProgress />
      </Box>
    );
  }

  const queryParams = new URLSearchParams(window.location.search);
  const urlError = queryParams.get('error');
  const urlErrorDesc = queryParams.get('error_description');

  if (error || urlError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height="100vh"
        width="100vw"
        p={3}
      >
        <Alert severity="error" sx={{ mb: 2, maxWidth: 650 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Fallo en la autenticación con Auth0
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {error?.message || `${urlError}: ${urlErrorDesc}`}
          </Typography>
        </Alert>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => {
            window.location.href = window.location.origin;
          }}
        >
          Limpiar URL y Reintentar Login
        </Button>
      </Box>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <RouterProvider router={router} />
      </AuthGuard>
    </QueryClientProvider>
  );
};

export default App;
