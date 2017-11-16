# Upload to Apperian Script
Script to upload apps to Apperian using the Apperian API

## Usage

  ```bash
  node index.js --username <username or email> --password <password> --appid com.propelics.test --apptype <ios|android|microsoft> --filepath "~/Documents/App.ipa" [--appname AppName] [--appversion 3.0.1] [--appauthor Propelics] [--longdesc "Long Description"] [--shortdesc "Description"] [--versionnotes "Version Notes"] [--create true] [-h]

  Options:
    -u, --username		Apperian username
    -p, --password		Apperian password
    -i, --appid			App identifier to search on the app catalog
    -t, --apptype			App type to search on the app catalog
    --filepath			Route to the compiled app, you can also use no tag for this
    -n, --appname			Application name
    -v, --appversion		App version
    -a, --appauthor		App author
    -l, --longdesc		Long description
    -s, --shortdesc		Short description
    -c, --versionnotes		Version notes
    --create			Set `true` to upload a new App, default: false
    -h				Show this help
	--sign			Signing Credentials description, this needs to be the exact description
    --dolog			Show console logging, default: false
  ```

## License

Copyright 2017 Propelics, Inc.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
