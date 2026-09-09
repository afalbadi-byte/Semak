import { createContext, useContext } from 'react';

// سياق فتح البطاقات — في ملف مستقل حتى يبقى ملف المكوّنات مكوّنات فقط
export const EntityCtx = createContext({ openEntity: () => {} });
export const useEntity = () => useContext(EntityCtx);
