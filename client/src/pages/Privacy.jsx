import './Privacy.css';
import useDocTitle from '../lib/useDocTitle.js';

export default function Privacy() {
  useDocTitle('Privacy Policy');
  return (
    <div className="privacy-page">
      <h1>Privacy Policy</h1>
      <p className="privacy-updated">Last updated: October 4, 2026</p>

      <p>
        This Privacy Policy describes how MovieVault ("we", "us") operates at
        https://movievault.sbs (the "Site"). By using the Site you agree to the practices
        described here.
      </p>

      <h2>1. Information we collect</h2>
      <p>
        We do not require accounts and we do not ask for personal information. We store
        preferences locally in your browser (for example the selected video server and
        subtitle choice) using local storage. Our servers may temporarily process standard
        technical data such as IP address, browser type and requested URLs in access logs
        for security and debugging purposes.
      </p>

      <h2>2. Cookies and advertising</h2>
      <p>
        Third-party vendors, including Google, use cookies to serve ads based on your prior
        visits to this or other websites. Google's use of advertising cookies enables it and
        its partners to serve ads to you based on your visit to our site and/or other sites
        on the internet.
      </p>
      <ul>
        <li>
          You may opt out of personalized advertising by visiting{' '}
          <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer">
            Google Ads Settings
          </a>
          .
        </li>
        <li>
          You may opt out of a third-party vendor's use of cookies for personalized
          advertising at{' '}
          <a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer">
            www.aboutads.info
          </a>{' '}
          or{' '}
          <a href="https://optout.networkadvertising.org/" target="_blank" rel="noreferrer">
            optout.networkadvertising.org
          </a>
          .
        </li>
        <li>
          Google's advertising policies are available at{' '}
          <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">
            policies.google.com/technologies/ads
          </a>
          .
        </li>
      </ul>

      <h2>3. Embedded content and third-party providers</h2>
      <p>
        Video content on the Site is delivered through third-party embed providers. Those
        providers may collect data and use cookies under their own privacy policies, which
        we do not control. We recommend reviewing them before use.
      </p>

      <h2>4. Metadata services</h2>
      <p>
        Movie and TV information (titles, posters, ratings) is fetched from public metadata
        APIs such as Simkl. No personally identifiable information about you is shared with
        these services beyond standard API requests.
      </p>

      <h2>5. Children's privacy</h2>
      <p>
        The Site is not directed at children under 13, and we do not knowingly collect
        personal information from children. If you believe a child has provided us
        information, contact us and we will remove it.
      </p>

      <h2>6. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Changes take effect when the
        updated policy is posted on this page. Continued use of the Site after changes
        constitutes acceptance of the revised policy.
      </p>

      <h2>7. Contact</h2>
      <p>
        Questions about this policy can be raised via the project's GitHub repository at{' '}
        <a href="https://github.com/Argyrys/MovieVault/issues" target="_blank" rel="noreferrer">
          github.com/Argyrys/MovieVault
        </a>
        .
      </p>
    </div>
  );
}
