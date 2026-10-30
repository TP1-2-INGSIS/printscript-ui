import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { Code, Logout, Rule } from '@mui/icons-material';
import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

type PageType = {
  title: string;
  path: string;
  icon: ReactNode;
};

const pages: PageType[] = [
  {
    title: 'Snippets',
    path: '/',
    icon: <Code />,
  },
  {
    title: 'Rules',
    path: '/rules',
    icon: <Rule />,
  },
];

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, loginWithRedirect } = useAuth0();

  return (
    <AppBar position="static" elevation={0}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ display: 'flex', gap: '24px' }}>
          <Typography
            variant="h6"
            noWrap
            component="a"
            sx={{
              display: { xs: 'none', md: 'flex' },
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            Printscript
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: '4px' }}>
            {pages.map((page) => (
              <Button
                key={page.title}
                onClick={() => navigate(`${page.path}`)}
                sx={{
                  my: 2,
                  color: 'white',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '4px',
                  backgroundColor:
                    location.pathname === page.path ? 'primary.light' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                }}
              >
                {page.icon}
                <Typography>{page.title}</Typography>
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isAuthenticated ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar
                    alt={user?.name ?? 'User'}
                    src={user?.picture}
                    sx={{ width: 32, height: 32 }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: 'white', display: { xs: 'none', sm: 'block' } }}
                  >
                    {user?.name ?? user?.email}
                  </Typography>
                </Box>
                <Tooltip title="Log out">
                  <Button
                    color="inherit"
                    variant="outlined"
                    size="small"
                    startIcon={<Logout />}
                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                  >
                    Logout
                  </Button>
                </Tooltip>
              </>
            ) : (
              <Button color="inherit" onClick={() => loginWithRedirect()}>
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
