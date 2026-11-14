@echo off
cd /d "%~dp0"
if exist out rmdir /s /q out
mkdir out
javac --release 25 -d out backend\src\com\bytebite\*.java || (echo Install JDK 25 first & exit /b 1)
start "" http://localhost:8080
java -Dstdout.encoding=UTF-8 -cp out com.bytebite.Main
