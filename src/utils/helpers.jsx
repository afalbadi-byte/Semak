export const API_URL = "https://semak.sa/api.php";

export const getImg = (id, sz = "w1500") => `https://drive.google.com/thumbnail?id=${id}&sz=${sz}`;

export const TIME_SLOTS = [
  "08:00 ص - 10:00 ص",
  "10:00 ص - 12:00 م",
  "01:00 م - 03:00 م",
  "04:00 م - 06:00 م"
];