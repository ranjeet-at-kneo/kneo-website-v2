use strict; use warnings;
use IO::Socket::INET;
my $root = shift or die "usage: serve.pl <root> [port]\n";
my $port = shift || 8123;
my %MIME = (
  html=>'text/html; charset=utf-8', css=>'text/css; charset=utf-8',
  js=>'application/javascript; charset=utf-8', svg=>'image/svg+xml',
  json=>'application/json', xml=>'application/xml', txt=>'text/plain; charset=utf-8',
  png=>'image/png', jpg=>'image/jpeg', jpeg=>'image/jpeg', webp=>'image/webp',
  mp4=>'video/mp4', woff2=>'font/woff2', ico=>'image/x-icon',
  # Documents the site offers for download. Without an entry here the server
  # falls through and the request hangs, which looks like a broken link.
  pdf=>'application/pdf', zip=>'application/zip', csv=>'text/csv; charset=utf-8',
);
# A browser streaming video opens a request, takes what it wants and hangs up.
# Writing to that closed socket raises SIGPIPE, whose default action is to kill
# the process - so the preview server died every time a video was requested.
$SIG{PIPE} = 'IGNORE';

my $srv = IO::Socket::INET->new(LocalAddr=>'127.0.0.1', LocalPort=>$port, Listen=>20, Reuse=>1)
  or die "bind $port: $!\n";
$| = 1;
print "serving $root on http://127.0.0.1:$port/\n";
while (my $c = $srv->accept) {
  my $req = <$c>;
  if (!defined $req) { close $c; next; }

  # ---- headers ----
  my $len = 0;
  my $range;
  while (my $l = <$c>) {
    last if $l =~ /^\r?\n$/;
    $len = $1 if $l =~ /^Content-Length:\s*(\d+)/i;
    $range = $1 if $l =~ /^Range:\s*bytes=(\S+)/i;
  }

  my ($path) = $req =~ m{^GET\s+(\S+)};
  $path = '/' unless defined $path;
  $path =~ s/\?.*$//;
  $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
  $path = '/index.html' if $path eq '/';
  $path =~ s{\.\.}{}g;
  my $file = $root . $path;
  $file .= 'index.html' if -d $file && $file =~ m{/$};
  $file .= '/index.html' if -d $file;
  if (-f $file) {
    my ($ext) = $file =~ /\.([A-Za-z0-9]+)$/;
    my $type = $MIME{lc($ext||'')} || 'application/octet-stream';
    open my $fh, '<:raw', $file or next;
    my $total = -s $file;

    # Byte ranges. Video elements seek by asking for one, and a server that
    # answers every request with the whole file makes seeking impossible - and
    # re-sends megabytes each time. Streamed in chunks rather than slurped so a
    # large file does not have to sit in memory.
    if (defined $range && $range =~ /^(\d*)-(\d*)$/ && ($1 ne '' || $2 ne '')) {
      my ($from, $to) = ($1, $2);
      if ($from eq '') { $from = $total - $to; $to = $total - 1; }   # suffix range
      else { $to = $total - 1 if $to eq ''; }
      $from = 0 if $from < 0;
      $to = $total - 1 if $to > $total - 1;
      if ($from > $to) {
        print $c "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */$total\r\nConnection: close\r\n\r\n";
        close $c; next;
      }
      my $span = $to - $from + 1;
      print $c "HTTP/1.1 206 Partial Content\r\nContent-Type: $type\r\n"
             . "Content-Range: bytes $from-$to/$total\r\nContent-Length: $span\r\n"
             . "Accept-Ranges: bytes\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
      seek $fh, $from, 0;
      my $left = $span;
      while ($left > 0) {
        my $want = $left > 65536 ? 65536 : $left;
        read($fh, my $buf, $want) or last;
        print $c $buf or last;      # client hung up; SIGPIPE is ignored above
        $left -= $want;
      }
      close $fh; close $c; next;
    }

    print $c "HTTP/1.1 200 OK\r\nContent-Type: $type\r\nContent-Length: $total\r\n"
           . "Accept-Ranges: bytes\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
    while (read($fh, my $buf, 65536)) { print $c $buf or last; }
    close $fh;
  } else {
    my $body = "404 Not Found: $path";
    print $c "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: ".length($body)."\r\nConnection: close\r\n\r\n$body";
  }
  close $c;
}
