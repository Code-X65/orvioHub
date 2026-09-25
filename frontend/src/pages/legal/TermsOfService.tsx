import { LegalList, LegalPage, LegalSection } from '@/components/legal/LegalPage';

export function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="These terms govern your use of Orviohub's account, organization, inventory, billing, and related application services."
    >
      <LegalSection title="1. Agreement and eligibility">
        <p>By creating an account, accepting an invitation, or using Orviohub, you agree to these Terms and our Privacy Policy. You must be legally capable of entering a binding agreement and provide accurate registration information.</p>
        <p>If you use Orviohub for an organization, you confirm that you have authority to act for it. An organization owner or authorized administrator is responsible for the organization account and the people they invite.</p>
      </LegalSection>

      <LegalSection title="2. The Orviohub service">
        <p>Orviohub provides a shared account and organization platform through which customers may access applications such as inventory management, branch operations, billing, reporting, notifications, and future business tools.</p>
        <p>Features labelled beta, preview, demo, or coming soon may be incomplete, change materially, or be withdrawn. Orviohub is an operational aid and does not replace professional accounting, tax, legal, or regulatory advice.</p>
      </LegalSection>

      <LegalSection title="3. Accounts, organizations, and access">
        <LegalList>
          <li>You are responsible for safeguarding your credentials, verification methods, and devices.</li>
          <li>You must promptly notify us if you suspect unauthorized account or organization access.</li>
          <li>Organization owners control member invitations, roles, branches, and application access.</li>
          <li>Members may access only the organizations, applications, and branches assigned to them.</li>
          <li>You may not impersonate another person, share an account improperly, or bypass access controls.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Customer data and responsibilities">
        <p>You retain your rights in the business information, inventory records, customer details, files, and other content submitted to Orviohub. You grant us permission to host, process, transmit, back up, and display that data only as needed to operate, secure, support, and improve the service.</p>
        <p>You are responsible for the accuracy and legality of your data, obtaining required notices or consent from staff and customers, configuring member permissions, and retaining records required for your business.</p>
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <p>You must not use Orviohub to violate law or third-party rights; distribute malware or abusive content; probe or disrupt the platform; evade quotas or security controls; scrape the service at unreasonable scale; or process stolen, fraudulent, or unlawfully obtained data.</p>
      </LegalSection>

      <LegalSection title="6. Plans, trials, payments, and taxes">
        <p>Plan limits may govern organizations, branches, applications, members, storage, or usage. Trial access may expire or become restricted at the end of the stated trial period. Paid subscriptions renew according to the interval shown at checkout unless cancelled.</p>
        <p>Prices, currency, taxes, processor fees, billing dates, and refund eligibility are shown during purchase or in your billing settings. Payments may be processed by third-party payment providers. We do not store full payment-card numbers or security codes.</p>
      </LegalSection>

      <LegalSection title="7. Availability and changes">
        <p>We work to keep Orviohub reliable and secure, but do not promise uninterrupted or error-free availability. Maintenance, provider outages, security events, or circumstances outside our reasonable control may affect access. We may modify the service and will provide reasonable notice when a material change adversely affects paid customers.</p>
      </LegalSection>

      <LegalSection title="8. Suspension and termination">
        <p>We may restrict or suspend access when reasonably necessary to protect the platform, comply with law, address non-payment, investigate fraud or abuse, or prevent harm. You may stop using Orviohub or request account deletion through available account controls. Organization data may remain subject to the owner's instructions, legal retention requirements, backups, and legitimate recordkeeping.</p>
      </LegalSection>

      <LegalSection title="9. Intellectual property">
        <p>Orviohub and its software, branding, documentation, and service design belong to Orviohub or its licensors. These Terms give you a limited, non-exclusive, non-transferable right to use the service during your account's active period; they do not transfer ownership of the platform.</p>
      </LegalSection>

      <LegalSection title="10. Disclaimers and liability">
        <p>To the extent permitted by applicable law, the service is provided “as available.” Orviohub is not responsible for business decisions made solely from demo, preview, estimated, or customer-entered information. Nothing in these Terms excludes liability that cannot legally be excluded.</p>
        <p>To the extent permitted by law, neither party will be liable for indirect, incidental, special, or consequential loss. Orviohub's aggregate liability arising from the service will not exceed the fees paid for the affected service during the 12 months before the event giving rise to the claim.</p>
      </LegalSection>

      <LegalSection title="11. Governing law and disputes">
        <p>These Terms are governed by the laws of the Federal Republic of Nigeria, without prejudice to mandatory consumer protections that apply where you live. Please contact us first so we can try to resolve a concern informally before formal proceedings.</p>
      </LegalSection>

      <LegalSection title="12. Changes and contact">
        <p>We may update these Terms as the platform or applicable requirements change. We will publish the revised date and provide additional notice for material changes where appropriate. Continued use after the effective date means the updated Terms apply.</p>
        <p>Questions about these Terms may be sent to <a className="text-[#c79dbd] hover:underline" href="mailto:legal@orviohub.com">legal@orviohub.com</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
