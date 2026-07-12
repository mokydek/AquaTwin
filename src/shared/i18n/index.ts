import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '@/shared/i18n/locales/en.json'
import ru from '@/shared/i18n/locales/ru.json'
import kk from '@/shared/i18n/locales/kk.json'

const STORAGE_KEY = 'aquatwin.lang'

type Language = 'en' | 'ru' | 'kk'

function readStoredLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'ru' || stored === 'kk') {
    return stored
  }
  return 'en'
}

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng)
  document.documentElement.lang = lng
})

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    kk: { translation: kk },
  },
  lng: readStoredLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: import.meta.env.DEV
    ? (languages, _namespace, key) => {
        const lng = Array.isArray(languages) ? languages.join(',') : languages
        console.warn(`[i18n] missing key "${key}" for ${lng}`)
      }
    : undefined,
})

export default i18n
