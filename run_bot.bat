@echo off
echo ===================================================
echo            Iniciador del Bot de Platzi
echo ===================================================
echo.
echo Iniciando una ventana de Chrome dedicada para el bot...
echo (Puedes mantener tu Chrome personal abierto)
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data Debug"

echo.
echo ===================================================
echo  [!] INSTRUCCIONES IMPORTANTES:
echo  1. Se ha abierto una nueva ventana de Google Chrome.
echo  2. Navega a Platzi e INICIA SESIÃ“N con tu cuenta.
echo  3. Una vez iniciada la sesiÃ³n, regresa a esta ventana
echo     y presiona cualquier tecla para iniciar el bot.
echo ===================================================
echo.
pause
echo.
echo Ejecutando platzi_bot.js...
"C:\Program Files\nodejs\node.exe" platzi_bot.js
echo.
pause
