HERO BACKGROUND VIDEO
=====================

The homepage hero works without any video. It renders a generated canvas
animation that needs no files, works offline, and can never fail to load.

To use real footage instead, place a file here named exactly:

    hero-factory.mp4

CURRENTLY INSTALLED
-------------------
  Source      "Untitled design.mp4"
  Resolution  1920 x 1080, H.264, no audio track
  Duration    39.0 s
  Size        24.8 MB          <-- well above the 4 MB target, see below
  Faststart   yes (moov atom moved to the front of the file)

HOW IT BEHAVES
--------------
assets/js/main.js loads the file and only fades it in once a frame has
actually decoded. It is deliberately skipped when:

  * the file is missing, corrupt, or takes longer than 4 seconds
  * the viewport is under 760px wide (phones never download it at all)
  * the browser reports data-saver mode
  * the visitor has "reduce motion" enabled

In every one of those cases the canvas visual simply stays. Nothing 404s
visibly, and the layout never shifts.

FASTSTART IS NOT OPTIONAL
-------------------------
An MP4 keeps its index (the "moov" atom) either at the front of the file or
at the end. Most editors write it at the end. When it is at the end a browser
must download essentially the WHOLE file before it can decode a single frame -
so a 25 MB clip blows straight past the 4 second timeout above and the video
never appears at all.

The installed file has been rewritten so moov comes first. It now decodes in
well under a second. If you replace the file, the replacement needs the same
treatment:

    ffmpeg -i input.mp4 -c copy -movflags +faststart hero-factory.mp4

That is a container rewrite, not a re-encode - it does not touch the picture.

RECOMMENDED ENCODING
--------------------
  Format      H.264 MP4, faststart
  Resolution  1920 x 1080
  Duration    10-20 seconds, seamlessly loopable
  Audio       none (the element is muted; strip the track to save size)
  File size   under ~4 MB

To bring the current file down to roughly that, re-encode it:

    ffmpeg -i "Untitled design.mp4" -an -t 20 \
           -vf "scale=1920:-2,fps=25" \
           -c:v libx264 -crf 30 -preset slow -profile:v high \
           -movflags +faststart hero-factory.mp4

Raise -crf to shrink further (28 is better quality, 34 smaller). Because the
hero sits under a 62-98% opaque overlay, heavy compression is far less visible
here than it would be on a normally presented video.

LEGIBILITY - AND WHY THE OVERLAY HAS EIGHT STOPS
------------------------------------------------
The overlay is a fixed vertical gradient, so the worst case is computable
rather than a matter of taste: evaluate every line of hero copy against both
extremes a video pixel can ever be (pure black and pure white), and nothing
the footage does can fall outside that.

It has eight stops because the hero is not uniformly demanding. A flat
gradient has to satisfy the hardest line on the page everywhere, which buries
the footage for no reason. What each band actually needs:

  band                        spans      needs   min alpha (dark / light)
  site nav (15px)             0.00-0.06    4.5      0.813 / 0.733
  badge                       0.16-0.20      -      any (paints its own bg)
  headline                    0.22-0.50    3.0      0.561 / 0.414
  lead paragraph              0.56-0.66    4.5      0.813 / 0.733
  meta headings (24px)        0.86-0.90    3.0      0.561 / 0.414
  meta labels (11px)          0.91-0.93    4.5      0.929 / 0.985

So the gradient thins right out across the headline band - the largest and
most visible part of the hero, needing only 3:1 - and stays heavy over the
11px labels, which are the binding constraint on the whole page.

Two things are easy to miss:

  * The site header is position:fixed with a transparent background, so the
    nav sits directly on the video. It has its own scrim (.site-header::before)
    which composes with the hero overlay; both are accounted for above.
  * The bottom of the LIGHT theme needs more cover than the dark one, not
    less. Dark 11px text over a possibly-black frame is the worst combination
    on the page, which is why that last stop is .99.

Achieved worst case, any frame, both themes:

  site nav          5.61 / 5.69      (needs 4.5)
  headline          3.83 / 3.69      (needs 3.0)
  lead              5.59 / 5.42      (needs 4.5)
  meta headings    12.57 / 18.54     (needs 3.0)
  meta labels       5.17 / 5.06      (needs 4.5)

If you make the meta labels lighter or smaller, or thin the last stop, re-run
that arithmetic before shipping it.

CHOOSING FOOTAGE
----------------
Use KNEO's own material where possible: robotic cells running, control panel
builds, commissioning work, SCADA screens, the shop floor. The hero applies a
dark gradient overlay for text legibility, so footage with a calm, uncluttered
centre works best.

A poster image (assets/img/hero-fallback.svg) is already wired up as the
video's fallback frame.
