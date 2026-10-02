BRAND LOGOS
===========

Drop logo files in this folder and run the build. That is the whole job -
no HTML editing. The build swaps the wordmark for the image automatically
wherever a matching file exists, and leaves the wordmark everywhere it
does not.

    1. save the file here, named after the slug below
    2. bash build.sh
    3. done


NAMING
------
The filename (without extension) must match the tile slug exactly.
Lower case. Accepted extensions: .svg (best) .png .webp .jpg

    bmw.svg          ->  BMW tile on the home page
    allen-bradley.svg ->  Allen-Bradley tile on Industrial Automation


AVAILABLE SLUGS
---------------
Home page - Automotive OEM standards:
    bmw  ford  volkswagen  zf  hyundai  mahindra  thyssenkrupp  sicar

Industrial Automation - Controllers:
    siemens  allen-bradley  mitsubishi  delta  keyence

Industrial Automation - Robotics:
    kuka  fanuc  abb  elite-robot  yaskawa

Industrial Automation - Visualization:
    factorytalk-view  wincc  ignition  labview  mapp

Industrial Automation - Engineering tools:
    eplan-p8  autocad-electrical  tia-portal  safety-evaluation-tool
    sew-motion-studio  industrial-physics

Industrial Automation - Standards:
    iso-9001-2015  iec-61131-3  iec-81346-1  ce  ul  iec  osha
    sil-pl  aiag-vda  as9102-vda


FILE PREPARATION
----------------
  Format      SVG preferred - stays sharp at any size and in both themes
  Background  transparent, no white box around the mark
  Trim        crop tight to the mark; padding is added by the CSS
  Height      any - the CSS renders every logo at 34px tall and keeps
              the aspect ratio, so a row of mixed logos stays aligned

Logos are desaturated by default so a grid of mixed-colour marks looks
composed, and return to full colour on hover. That is a CSS choice - tell
your developer to remove the filter on .logo-tile__img if a vendor's brand
guidelines forbid it.

The brand name in the markup becomes the image alt text automatically, so
screen readers and search engines still read "BMW", "Siemens" and so on.


BEFORE YOU ADD ANY FILE - PLEASE READ
-------------------------------------
These marks are registered trademarks owned by their companies. They are
not free to republish just because the file can be downloaded.

  * Most vendors publish brand guidelines governing colour, spacing,
    minimum size and permitted context.
  * Several require written permission before a third party displays
    their mark commercially.
  * Automotive OEMs are usually the strictest. Some supplier agreements
    prohibit public use of the OEM's marks outright without consent.
    Check your agreements with BMW, Ford, VW, ZF, Hyundai, Mahindra and
    thyssenkrupp before publishing those.

BETTER OPTION: if KNEO is enrolled in a vendor's partner or system
integrator programme, that programme normally issues an approved "Partner"
badge plus a media kit. A partner badge is both safer and more persuasive
to a buyer than the plain corporate logo.

Until logo files are added, the wordmark tiles are a deliberate and
perfectly professional fallback - they carry no legal risk and they also
state what KNEO does with each platform, which a bare logo does not.


-------------------------------------------------------------------
CURRENTLY INSTALLED
-------------------------------------------------------------------
  bmw.png  ford.png  volkswagen.png  zf.png
  hyundai.png  mahindra.png  thyssenkrupp.png  sicar.png

These fill the Automotive OEM Standards grid on the home page.
sicar.png is the Siemens mark, matching the source slide where the
Siemens logo sits above "SICAR STANDARD".

_siemens.png.disabled
  The same Siemens mark, parked. Renaming it back to siemens.png would
  put a real logo on the Controllers tab of the Industrial Automation
  page - but its four neighbours (Allen-Bradley, Mitsubishi, Delta,
  Keyence) are still wordmarks, and one logo among four wordmarks reads
  as a mistake rather than a design choice.

  To complete that tab, add:
      allen-bradley.png   mitsubishi.png   delta.png   keyence.png
  then rename _siemens.png.disabled back to siemens.png and rebuild.

Still wordmarks elsewhere - add files any time using the slug list above:
  Robotics          kuka  fanuc  abb  elite-robot  yaskawa
  Visualization     factorytalk-view  wincc  ignition  labview  mapp
  Engineering tools eplan-p8  autocad-electrical  tia-portal
                    safety-evaluation-tool  sew-motion-studio
                    industrial-physics
