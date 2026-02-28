@echo off

echo Backup Started...

copy /Y "D:\MadrasaServer\database\madrasa.db" "D:\MadrasaBackup\madrasa.db"

cd /d D:\MadrasaBackup

git add .
git commit -m "Auto backup %date% %time%"
git push origin main

echo Backup Completed