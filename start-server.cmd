@echo off
REM ===========================================================================
REM  KNEO Automation website - local preview server
REM  Double-click this file to view the site at http://localhost:8123/
REM
REM  You do NOT need this to view the site - you can just double-click
REM  index.html. Use this when you want to test things that need a real
REM  web server: sitemap.xml, robots.txt, the 404 page, or share the site
REM  with someone else on your network.
REM
REM  Leave this window OPEN while you browse. Closing it stops the server,
REM  and every link on the site will stop working until you start it again.
REM ===========================================================================

setlocal
cd /d "%~dp0"

set "PERL=%ProgramFiles%\Git\usr\bin\perl.exe"
if not exist "%PERL%" set "PERL=%ProgramFiles(x86)%\Git\usr\bin\perl.exe"
if not exist "%PERL%" set "PERL=%LOCALAPPDATA%\Programs\Git\usr\bin\perl.exe"

if not exist "%PERL%" (
  echo.
  echo  Could not find Perl ^(it ships with Git for Windows^).
  echo  No problem - the site works without a server.
  echo  Just double-click index.html instead.
  echo.
  pause
  exit /b 1
)

echo.
echo   KNEO Automation - local preview
echo   ------------------------------------------------
echo   Serving:  %CD%
echo   Open:     http://localhost:8123/
echo.
echo   KEEP THIS WINDOW OPEN while browsing.
echo   Press Ctrl+C or close this window to stop.
echo.

start "" "http://localhost:8123/"
"%PERL%" "_tools\serve.pl" "%CD%" 8123

endlocal
