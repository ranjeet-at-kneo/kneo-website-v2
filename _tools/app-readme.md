# KNEO Auto Ballooning

Reads the dimensions off a CAD-exported PDF and balloons them, then gives you
the characteristics as a table. Everything runs on this machine.

This is the same tool that runs on the KNEO website, packaged as a project of
its own.

## Open it in VS Code

`File → Open Folder…` and pick this folder.

Two ways to run it:

**Just open it.** Double-click `index.html`, or right-click it in VS Code and
choose *Reveal in File Explorer*, then open it. No server, nothing to install.

**Run the dev server** — recommended while you are working on it:

```
npm start
```

Then open <http://localhost:5173>. No packages to install: `server.js` has no
dependencies and uses only what Node already ships with.

The server is worth using for a second reason. A page opened straight from
disk has no origin, so the browser refuses to let it start a Web Worker, and
PDF.js has to parse on the main thread instead — it still works, but a large
sheet takes noticeably longer and the window is unresponsive while it reads.
Served over http it uses the worker and stays smooth.

If you prefer the Live Server extension, it is in the recommended extensions
and is configured for port 5599.

## Your drawings stay on your machine

The PDF is read inside the browser window. The app makes no network request of
any kind and nothing is uploaded. Disconnect from the network entirely and it
still works.

## Using it

**Import drawing** opens a file picker. **Use sample drawing** loads the
built-in bracket if you just want to see how it behaves.

1. **Import** a PDF, or drag one onto the drawing area.
2. **Auto capture** takes the whole sheet. Or turn on the **Pen** and trace
   around a single view — on a sheet where the views sit close together a box
   always catches the neighbour, and a traced outline does not. The **Pen
   thickness** slider thins the line for a tight trace.
3. **Start ballooning.**
4. Review the table. **Hide map** takes the balloons *and the values they
   captured* off the drawing, so whatever is still showing is what has not
   been captured yet. **Manual map** then lets you box those one at a time.
5. Each row has a **⋮** menu to edit or delete it. Deleting renumbers the rest.

Zoom sits on the drawing, top right. Ctrl (or Cmd) with the mouse wheel zooms
at the pointer; hold Space or use the middle mouse button to pan.

## What it can and cannot read

It reads the **text layer** of a PDF, so it works on a PDF exported from CAD
where the dimensions are real text with real coordinates. No OCR is involved,
which is why it is fast and why it is accurate on those files.

It cannot read a **scanned** drawing — a scan is a picture and has no text in
it. The app says so when it meets one, and the drawing still loads so Manual
map can be used on it.

Some things are not in a PDF's text layer at all. On many CAD sheets the
diameter symbol and the GD&T symbols are drawn as geometry rather than as
characters; the values beside them read correctly, but the symbol itself
cannot be recovered from the file.

**It will not catch everything, on any drawing.** Overlapping leaders, stacked
tolerances and unusual callouts defeat automatic extraction — that is true of
every tool of this kind, and it is why Manual map exists. Read the table
before you rely on it.

## Layout

```
index.html        the app
css/app.css       styling
js/app.js         all behaviour, one file
server.js         zero-dependency dev server for `npm start`
vendor/pdf/       PDF.js
```

`js/app.js` is generated from the website source by
`_tools/build-standalone.js` in the website repository, so the two cannot
drift. Edit it here freely if this project is going its own way — just know
that re-running that script overwrites it.

## Export

**Export to Excel** and **Send to inspection plan** are demonstration buttons
in this build and link to a contact page.

## Third-party

PDF reading uses Mozilla's PDF.js (Apache License 2.0) in `vendor/pdf/`. The
full licence notice is preserved at the top of both files.
