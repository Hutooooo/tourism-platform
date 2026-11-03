import { useTranslation } from 'react-i18next';

/**
 * Returns translated direction labels using the current language.
 * Call this inside a component that has access to useTranslation().
 */
export function useDirectionLabels() {
  const { t } = useTranslation();
  return {
    SL_TO_IT: t('direction.SL_TO_IT'),
    IT_TO_SL: t('direction.IT_TO_SL'),
    BOTH: t('direction.BOTH'),
  };
}

/**
 * Plain direction label map for non-component contexts (e.g., SSR, utils).
 * Returns English fallbacks. Components should use useDirectionLabels().
 */
export const DIRECTION_LABEL_FALLBACK = {
  SL_TO_IT: 'Sri Lanka → Italy',
  IT_TO_SL: 'Italy → Sri Lanka',
  BOTH: 'Both directions',
};