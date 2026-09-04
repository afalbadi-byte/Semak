@echo off
rem النسخة الاحتياطية اليومية لبيانات سماك إلى قوقل درايف
rem تُسجَّل كمهمة مجدولة على جهاز العمل الذي يعمل على مدار الساعة
cd /d "%~dp0.."
node scripts\backup-daftra.cjs >> "%TEMP%\semak-backup.log" 2>&1
