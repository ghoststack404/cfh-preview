import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';

export const locales = ['es', 'en', 'pt', 'fr', 'de', 'it', 'zh', 'ja', 'ko', 'ru', 'ar', 'hi'];
export const defaultLocale = 'es';

export default getRequestConfig(async ({requestLocale}) => {
  const rawLocale = await requestLocale;
  let locale = rawLocale?.toLowerCase();
  console.log('getRequestConfig called with requestLocale:', rawLocale, 'normalized:', locale);
  if (!locale || !locales.includes(locale)) {
    locale = defaultLocale;
  }

  return {
    messages: (await import('./messages/' + locale + '.json')).default,
    locale,
    onError: () => {},
    getMessageFallback: ({key}) => key
  };
});
