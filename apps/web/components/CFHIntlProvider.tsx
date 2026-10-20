"use client";
import { NextIntlClientProvider } from 'next-intl';

export function CFHIntlProvider({ messages, locale, children }: any) {
  return (
    <NextIntlClientProvider 
      messages={messages} 
      locale={locale}
      onError={() => {}}
      getMessageFallback={({key}) => key}
    >
      {children}
    </NextIntlClientProvider>
  );
}
