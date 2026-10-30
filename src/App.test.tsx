import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import * as auth0 from '@auth0/auth0-react';
import { PaginationProvider } from './contexts/paginationProvider';
import { SnackbarProvider } from './contexts/snackbarProvider';

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: vi.fn(),
  Auth0Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const createMockAuth0 = (
  overrides: Partial<auth0.Auth0ContextInterface> = {},
): auth0.Auth0ContextInterface => ({
  isLoading: false,
  isAuthenticated: false,
  user: undefined,
  error: undefined,
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
  getAccessTokenSilently:
    vi.fn() as unknown as auth0.Auth0ContextInterface['getAccessTokenSilently'],
  getAccessTokenWithPopup:
    vi.fn() as unknown as auth0.Auth0ContextInterface['getAccessTokenWithPopup'],
  getIdTokenClaims: vi.fn() as unknown as auth0.Auth0ContextInterface['getIdTokenClaims'],
  loginWithPopup: vi.fn(),
  handleRedirectCallback:
    vi.fn() as unknown as auth0.Auth0ContextInterface['handleRedirectCallback'],
  ...overrides,
});

const renderApp = () => {
  return render(
    <PaginationProvider>
      <SnackbarProvider>
        <App />
      </SnackbarProvider>
    </PaginationProvider>,
  );
};

describe('Auth0 Integration & Protected Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading spinner when Auth0 is in loading state', () => {
    const mockLoginWithRedirect = vi.fn();
    vi.mocked(auth0.useAuth0).mockReturnValue(
      createMockAuth0({
        isLoading: true,
        loginWithRedirect: mockLoginWithRedirect,
      }),
    );

    renderApp();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(mockLoginWithRedirect).not.toHaveBeenCalled();
    expect(screen.queryByText('Printscript')).not.toBeInTheDocument();
  });

  it('triggers loginWithRedirect when user is unauthenticated and not loading', () => {
    const mockLoginWithRedirect = vi.fn();
    vi.mocked(auth0.useAuth0).mockReturnValue(
      createMockAuth0({
        isLoading: false,
        isAuthenticated: false,
        loginWithRedirect: mockLoginWithRedirect,
      }),
    );

    renderApp();

    expect(mockLoginWithRedirect).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Printscript')).not.toBeInTheDocument();
  });

  it('displays error alert and does NOT loop/redirect when Auth0 returns an error', () => {
    const mockLoginWithRedirect = vi.fn();
    vi.mocked(auth0.useAuth0).mockReturnValue(
      createMockAuth0({
        isLoading: false,
        isAuthenticated: false,
        error: new Error('Client is not authorized to access resource server'),
        loginWithRedirect: mockLoginWithRedirect,
      }),
    );

    renderApp();

    expect(screen.getByText(/Fallo en la autenticación con Auth0/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Client is not authorized to access resource server/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Limpiar URL y Reintentar Login/i }),
    ).toBeInTheDocument();

    // Critical check: loginWithRedirect MUST NOT be called on error to prevent infinite reload loop
    expect(mockLoginWithRedirect).not.toHaveBeenCalled();
  });

  it('renders application and Navbar with user info when authenticated', () => {
    vi.mocked(auth0.useAuth0).mockReturnValue(
      createMockAuth0({
        isLoading: false,
        isAuthenticated: true,
        user: {
          name: 'Bautista Dhipolito',
          email: 'bautidhipolito@gmail.com',
          picture: 'https://example.com/avatar.png',
        },
      }),
    );

    renderApp();

    expect(screen.getByText('Printscript')).toBeInTheDocument();
    expect(screen.getByText('Bautista Dhipolito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log out/i })).toBeInTheDocument();
  });

  it('triggers Auth0 logout when clicking the Logout button', () => {
    const mockLogout = vi.fn();
    vi.mocked(auth0.useAuth0).mockReturnValue(
      createMockAuth0({
        isLoading: false,
        isAuthenticated: true,
        user: {
          name: 'Bautista Dhipolito',
          email: 'bautidhipolito@gmail.com',
        },
        logout: mockLogout,
      }),
    );

    renderApp();

    const logoutButton = screen.getByRole('button', { name: /Log out/i });
    fireEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    });
  });
});
