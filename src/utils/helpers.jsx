// مراجعة: جعل الدالة تدعم المسارات المحلية والروابط الخارجية معاً
export const getImg = (pathOrId, sz = "w1500") => {
  if (!pathOrId) return "";

  // إذا كان المسار يبدأ بـ / معناه صورة محلية في مجلد public
  if (pathOrId.startsWith('/')) {
    return pathOrId;
  }
  
  // غير ذلك، يفترض أنه ID من جوجل درايف (كخيار احتياطي)
  return `https://drive.google.com/thumbnail?id=${pathOrId}&sz=${sz}`;
};

// الثوابت الأخرى تبقى كما هي
export const API_URL = "https://semak.sa/api.php";
export const TIME_SLOTS = [
  "08:00 ص - 10:00 ص",
  "10:00 ص - 12:00 م",
  "01:00 م - 03:00 م",
  "04:00 م - 06:00 م"
];