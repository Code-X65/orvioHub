import { LegalList, LegalPage, LegalSection } from '@/components/legal/LegalPage';

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="This policy explains what personal data Orviohub handles, why we use it, who receives it, and the choices available to you."
    >
      <LegalSection title="1. Scope and roles">
        <p>This Policy applies to Orviohub websites, accounts, applications, support, and related services. Orviohub acts as a controller for account, billing, security, marketing, and platform-administration data.</p>
        <p>For business data entered by an organization—such as its staff, customers, inventory, or transaction records—the organization generally decides why that data is used, while Orviohub processes it to provide the service.</p>
      </LegalSection>

      <LegalSection title="2. Data we collect">
        <LegalList>
          <li><strong className="text-white">Account and profile:</strong> name, email, phone, country, profile details, authentication methods, preferences, and consents.</li>
          <li><strong className="text-white">Organization data:</strong> business profile, members, roles, invitations, applications, branches, and settings.</li>
          <li><strong className="text-white">Operational data:</strong> inventory, catalog, stock, sales, customer, receipt, and reporting information that you submit.</li>
          <li><strong className="text-white">Billing data:</strong> plan, invoices, transaction references, payment status, and limited payment metadata received from processors.</li>
          <li><strong className="text-white">Device and usage:</strong> IP address, browser, device, session, activity, diagnostics, logs, and security events.</li>
          <li><strong className="text-white">Communications:</strong> support requests, feedback, notification delivery, and marketing choices.</li>
        </LegalList>
        <p>We do not ask you to provide full card numbers or card security codes directly to Orviohub. Payment providers handle those details under their own privacy terms.</p>
      </LegalSection>

      <LegalSection title="3. Why we use data">
        <LegalList>
          <li>Create and secure accounts, verify contact details, and maintain sessions.</li>
          <li>Provide organizations, applications, branches, permissions, inventory, and support.</li>
          <li>Administer trials, subscriptions, payments, invoices, limits, and service communications.</li>
          <li>Detect fraud, investigate abuse, maintain audit trails, and protect users and the platform.</li>
          <li>Understand performance, diagnose errors, and improve features and accessibility.</li>
          <li>Send product news when you have opted in; you can unsubscribe at any time.</li>
          <li>Comply with law, lawful requests, accounting duties, and dispute resolution.</li>
        </LegalList>
        <p>Depending on the context, we rely on performance of a contract, consent, legal obligations, and legitimate interests such as service security and improvement.</p>
      </LegalSection>

      <LegalSection title="4. How data is shared">
        <p>We may share data with authorized members of your organization according to their roles, and with vendors that help us provide hosting, database, email, SMS, analytics, error monitoring, support, and payment services. Vendors may use data only for agreed services and must protect it.</p>
        <p>We may also disclose data when required by law, to protect rights and safety, during a corporate transaction subject to appropriate safeguards, or when you direct or consent to the disclosure. We do not sell personal data.</p>
      </LegalSection>

      <LegalSection title="5. International transfers">
        <p>Some service providers may process information outside your country. Where required, we use contractual, organizational, and legal safeguards designed to provide an adequate level of protection.</p>
      </LegalSection>

      <LegalSection title="6. Retention">
        <p>We keep personal data only as long as reasonably needed for the purposes described here, including account operation, security, billing, legal compliance, disputes, and backups. Retention varies by record type. Audit, transaction, tax, fraud-prevention, and legal records may be kept longer than ordinary profile data.</p>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>We use access controls, tenant isolation, authentication safeguards, rate limits, encryption in transit, monitoring, secret filtering, audit logs, and controlled administrative access. No system is completely secure, so you should use a strong unique password, protect verification codes, and report suspicious activity promptly.</p>
      </LegalSection>

      <LegalSection title="8. Your rights and choices">
        <p>Subject to applicable law, including the Nigeria Data Protection Act 2023, you may ask to access, correct, erase, restrict, or receive a copy of your personal data; object to certain processing; withdraw consent; and complain to the Nigeria Data Protection Commission or another competent authority.</p>
        <p>You can update many details through account settings and control optional marketing separately from required service and security messages. A request may require identity verification, and some data may be retained where law or legitimate recordkeeping requires it.</p>
      </LegalSection>

      <LegalSection title="9. Cookies and similar technologies">
        <p>Orviohub uses essential storage and cookies for authentication, security, preferences, and cross-subdomain sessions. Where non-essential analytics or marketing technologies require consent, we will provide appropriate controls. Blocking essential cookies may prevent sign-in or other core features from working.</p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>Orviohub is designed for businesses and is not directed to children. Do not create an account or submit a child's personal data unless you have lawful authority and all required consent.</p>
      </LegalSection>

      <LegalSection title="11. Updates and contact">
        <p>We may revise this Policy when our services or legal obligations change. We will post the new effective date and provide additional notice when a change is material.</p>
        <p>For privacy questions or rights requests, contact <a className="text-[#c79dbd] hover:underline" href="mailto:privacy@orviohub.com">privacy@orviohub.com</a>. You may also contact the Nigeria Data Protection Commission if you believe your data-protection rights have been infringed.</p>
      </LegalSection>
    </LegalPage>
  );
}
