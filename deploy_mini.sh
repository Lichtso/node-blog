SERVER=mf-lex2.dyndns.org

ssh -A -l nodejs $SERVER <<SCRIPT

INSTANCE=de.mfelten.blog
GIT_URL=git@github.com:Lichtso/node-blog.git
PATH=\$PATH:/usr/local/bin

mkdir -p instances/\$INSTANCE
cd instances/\$INSTANCE

if [ -d .git ] ; then
  git pull
else
  git clone \$GIT_URL .
fi

npm install

cat >>/tmp/\$INSTANCE.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN"
        "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
		<string>\$INSTANCE</string>
	<key>ProgramArguments</key>
		<array>
			<string>/usr/local/bin/node</string>
			<string>app.js</string>
		</array>
	<key>KeepAlive</key>
		<dict>
			<key>NetworkState</key>
			<true/>
		</dict>
	<key>UserName</key>
		<string>nodejs</string>
	<key>WorkingDirectory</key>
		<string>/Groups/dvlp/nodejs/instances/\$INSTANCE</string>
</dict>
</plist>
EOF

SCRIPT

ssh -A -l root $SERVER <<SCRIPT

INSTANCE=de.mfelten.blog

mv /tmp/\$INSTANCE.plist /Library/LaunchDaemons
chown root /Library/LaunchDaemons/\$INSTANCE.plist
launchctl unload /Library/LaunchDaemons/\$INSTANCE.plist
launchctl load /Library/LaunchDaemons/\$INSTANCE.plist

SCRIPT
