# PDF.js (vendored)

Mozilla PDF.js **v3.11.174**, taken unmodified from
`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/`.

| File | Purpose |
| --- | --- |
| `pdf.min.js` | The API. Injected on demand by `initAutoBalloon()`. |
| `pdf.worker.min.js` | The parser, which runs in a Web Worker. |

Licensed under the Apache License 2.0. The full licence notice is preserved at
the top of both files.

## Why it is vendored rather than loaded from a CDN

The visitors this feature is for are manufacturing engineers, and corporate
proxies frequently block public CDNs. Serving it from our own origin means the
feature cannot fail for exactly the people it is meant to impress. It also
keeps a third party out of the request path for a page where someone is
handling a confidential part drawing.

## Why it costs nothing on page load

Neither file is referenced by any page. `initAutoBalloon()` injects
`pdf.min.js` the first time a visitor actually picks a file, and sets
`GlobalWorkerOptions.workerSrc` to the worker beside it. A visitor who never
imports a drawing downloads zero bytes of this.

## Upgrading

Replace both files with the same version of each, and check
`initAutoBalloon()` still works end to end — v4 moved to ES modules (`.mjs`)
and a `<script>` tag will not load it, so that is not a drop-in swap.
