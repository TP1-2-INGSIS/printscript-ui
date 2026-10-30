import { AUTH0_USERNAME, AUTH0_PASSWORD } from '../../src/utils/constants';

describe('Protected routes test', () => {
  it('should redirect to Auth0 login when accessing a protected route unauthenticated', () => {
    cy.visit('/');

    // Verify redirection to Auth0 Universal Login domain
    cy.url().should('match', /auth0\.com/);
  });

  it('should allow access and render navigation when authenticated', () => {
    if (AUTH0_USERNAME && AUTH0_PASSWORD) {
      cy.loginToAuth0(AUTH0_USERNAME, AUTH0_PASSWORD);

      cy.visit('/');

      // Should remain on the app and not redirect to Auth0
      cy.url().should('not.match', /auth0\.com/);
      cy.contains('Printscript').should('exist');
      cy.get('[aria-label="Log out"]').should('exist');
    } else {
      cy.log('AUTH0_USERNAME and AUTH0_PASSWORD not provided, skipping live Auth0 login');
    }
  });
});
