import { useEffect } from 'react';

const SITE = 'سماك العقارية';

export default function PageMeta({ title, description }) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : `${SITE} | سقف يعلو برؤيتك، ومسكن يحكي قصتك`;

    const setMeta = (attr, key, value) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.content = value;
    };

    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }
    if (title) {
      setMeta('property', 'og:title', `${title} | ${SITE}`);
      setMeta('name', 'twitter:title', `${title} | ${SITE}`);
    }
    setMeta('property', 'og:url', window.location.href);
  }, [title, description]);

  return null;
}
