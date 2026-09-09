import React, { useEffect } from 'react';
import { useHost } from '@/host/useHost';
import { getApplicationUrl } from '@/lib/domain';

interface SeoMetaProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  softwareApplication?: {
    name: string;
    operatingSystem?: string;
    applicationCategory?: string;
    price?: string;
    priceCurrency?: string;
  };
}

export const SeoMeta: React.FC<SeoMetaProps> = ({
  title,
  description,
  canonicalPath = '',
  ogImage,
  softwareApplication,
}) => {
  const host = useHost();

  useEffect(() => {
    // 1. Title
    document.title = title;

    // Helper to update or create meta tags
    const setMetaTag = (attr: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector(`meta[${attr}="${key}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, key);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Standard Meta Tags
    setMetaTag('name', 'description', description);

    // 3. Open Graph
    const appUrl = getApplicationUrl(host.application, host.environment, canonicalPath);
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', appUrl);
    setMetaTag('property', 'og:type', 'website');
    if (ogImage) {
      setMetaTag('property', 'og:image', ogImage);
    }

    // 4. Twitter Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', description);

    // 5. Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', appUrl);

    // 6. Structured Data (JSON-LD SoftwareApplication)
    let jsonLdScript = document.getElementById('seo-json-ld');
    if (softwareApplication) {
      if (!jsonLdScript) {
        jsonLdScript = document.createElement('script');
        jsonLdScript.id = 'seo-json-ld';
        jsonLdScript.setAttribute('type', 'application/ld+json');
        document.head.appendChild(jsonLdScript);
      }

      const schema = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: softwareApplication.name,
        operatingSystem: softwareApplication.operatingSystem || 'Web Browser, Windows, Android, iOS',
        applicationCategory: softwareApplication.applicationCategory || 'BusinessApplication',
        description,
        url: appUrl,
        offers: softwareApplication.price
          ? {
              '@type': 'Offer',
              price: softwareApplication.price,
              priceCurrency: softwareApplication.priceCurrency || 'NGN',
            }
          : undefined,
      };

      jsonLdScript.textContent = JSON.stringify(schema);
    } else if (jsonLdScript) {
      jsonLdScript.remove();
    }
  }, [title, description, canonicalPath, ogImage, softwareApplication, host]);

  return null;
};
export default SeoMeta;
